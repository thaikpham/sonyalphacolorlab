'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import {
  compareCameras,
  DEFAULT_WIKI_SORT,
  type CameraCard,
  type ProductCategory,
  type SonyCamera,
  type WikiSort,
} from '@/lib/cameras/types';
import { featureList, splitFeatures } from '@/lib/cameras/features';
import { calculateMatchScore } from '@/lib/search/fuzzy-search';

/**
 * Category chip label, per category.
 *
 * A lookup rather than a chained ternary: the ternary had no branch for a
 * fourth category, so `audio` fell through to the `catAccessory` label and the
 * active-filter chip read "Phụ kiện" over a page of headphones.
 */
const CATEGORY_LABEL_KEY: Record<string, string> = {
  camera: 'catCamera',
  lens: 'catLens',
  accessory: 'catAccessory',
  audio: 'catAudio',
};

/** Catalogue order for the first facet group. Only the ones present are drawn. */
const CATEGORY_ORDER: ProductCategory[] = ['camera', 'lens', 'accessory', 'audio'];

/**
 * The two accent recipes this screen repeats.
 *
 * A selection is a FILL, never a stroke: the accent gradient plus a shadow cast
 * in the accent's own hue. Both are written out of the accent ramp rather than
 * out of literals, so a change to the ramp moves the selection with it.
 */
const ACCENT_FILL =
  'bg-[linear-gradient(180deg,color-mix(in_oklch,var(--color-accent-500)_82%,white),var(--color-accent-500))] ' +
  'text-white shadow-[0_6px_16px_-6px_color-mix(in_oklch,var(--color-accent-500)_55%,transparent),var(--elevation-spec)]';

const ROW_SELECTED =
  'bg-[linear-gradient(180deg,color-mix(in_oklch,var(--color-accent-500)_20%,transparent),color-mix(in_oklch,var(--color-accent-500)_7%,transparent))] ' +
  'rounded-lg backdrop-blur-[30px] ' +
  'shadow-[0_4px_12px_oklch(0%_0_0/0.5),0_26px_60px_-20px_color-mix(in_oklch,var(--color-accent-500)_40%,transparent),var(--elevation-spec)]';

/** 13px/500 on a white 8% film — the spec chip of the wiki row. */
const CHIP =
  'text-label font-medium text-ink px-3 py-1.5 rounded-sm bg-white/[0.08] shadow-[var(--elevation-spec)]';

/**
 * The category tag, tinted by what the row *is*.
 *
 * Two tints and a neutral, not four: a colour per category would put four
 * signals in one list and turn classification into decoration.
 */
const CATEGORY_TAG_CLASS: Record<string, string> = {
  camera: 'bg-accent-400/15 text-accent-400',
  audio: 'bg-community/15 text-community',
  lens: 'bg-white/[0.08] text-ink-muted',
  accessory: 'bg-white/[0.08] text-ink-muted',
};

/** Stands in for product photography the source does not publish. */
function NoPhoto({ label }: { label?: string }) {
  return (
    <span className="flex flex-col items-center justify-center gap-1 text-void/40">
      <span className="text-title-2 leading-none" aria-hidden>
        ◫
      </span>
      {label && <span className="text-label font-semibold">{label}</span>}
    </span>
  );
}

interface CameraWikiViewProps {
  /* Cards, not full products: the spec blocks would be a third of this page's
     payload and nothing here renders them. See `CameraCard`. */
  initialCameras: CameraCard[];
  /**
   * Route this grid belongs to — `/cameras` or `/audio`.
   *
   * Every navigation out of this component is built from it: the filter query
   * string, a product page, the compare page. It was five hardcoded
   * `/cameras` literals, which is why the second catalogue could not reuse the
   * grid: picking a sort on `/audio` navigated to the camera catalogue.
   */
  basePath?: string;
}

export function CameraWikiView({ initialCameras, basePath = '/cameras' }: CameraWikiViewProps) {
  const t = useTranslations('cameras');
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();

  const selectedCategory = (searchParams?.get('cat') as ProductCategory) || 'all';
  const selectedSub1 = searchParams?.get('sub1') || 'all';
  const selectedSub2 = searchParams?.get('sub2') || 'all';
  const searchQuery = searchParams?.get('q') || '';
  const sortBy = (searchParams?.get('sort') as WikiSort) || DEFAULT_WIKI_SORT;
  const viewMode = (searchParams?.get('view') as 'table' | 'grid') || 'grid';

  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

  const updateWikiParam = (patch: Record<string, string>) => {
    const params = new URLSearchParams(Array.from(searchParams?.entries() ?? []));
    for (const [key, value] of Object.entries(patch)) {
      // The default ordering is the absence of `?sort=`, so it never goes in.
      if (!value || value === 'all' || (key === 'sort' && value === DEFAULT_WIKI_SORT) || (key === 'view' && value === 'grid')) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
    const qs = params.toString();
    router.push(qs ? `${basePath}?${qs}` : basePath, { scroll: false });
  };

  /* A product opens its own page. It used to open a modal and fake the URL with
     pushState, which left the address bar pointing at a page that had never
     rendered — reload or share the link and you got the bare catalogue. */
  const openProduct = (cam: SonyCamera) => router.push(`${basePath}/${cam.id}`);

  /**
   * The facet rail's three groups — the catalogue's own axes.
   *
   * Options and counts are read off the catalogue that was handed in, never
   * invented and never hardcoded: an option that no product carries would
   * filter the list down to nothing, and a count that does not come from this
   * array is a number the data never stated. `sub1` narrows to the chosen
   * category and `sub2` to the chosen `sub1`, so the rail can never offer a
   * combination the catalogue has no row for.
   */
  const facets = useMemo(() => {
    const inCategory =
      selectedCategory === 'all'
        ? initialCameras
        : initialCameras.filter((c) => c.category === selectedCategory);
    const inSub1 =
      selectedSub1 === 'all' ? inCategory : inCategory.filter((c) => c.subCategory1 === selectedSub1);

    const tally = (list: CameraCard[], read: (c: CameraCard) => string) => {
      const counts = new Map<string, number>();
      for (const c of list) {
        const key = read(c);
        if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      return counts;
    };

    const byCategory = tally(initialCameras, (c) => c.category);
    const bySub1 = tally(inCategory, (c) => c.subCategory1);
    const bySub2 = tally(inSub1, (c) => c.subCategory2);

    const sorted = (counts: Map<string, number>) =>
      Array.from(counts.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([value, count]) => ({ value, label: value, count }));

    return [
      {
        key: 'cat',
        name: t('categoryLabel'),
        selected: selectedCategory,
        options: [
          { value: 'all', label: t('catAll'), count: initialCameras.length },
          ...CATEGORY_ORDER.filter((cat) => byCategory.has(cat)).map((cat) => ({
            value: cat as string,
            label: t(CATEGORY_LABEL_KEY[cat] ?? 'catAll'),
            count: byCategory.get(cat) ?? 0,
          })),
        ],
      },
      {
        key: 'sub1',
        name: t('specSub1'),
        selected: selectedSub1,
        options: [
          { value: 'all', label: t('sub1All'), count: inCategory.length },
          ...sorted(bySub1),
        ],
      },
      {
        key: 'sub2',
        name: t('specSub2'),
        selected: selectedSub2,
        options: [{ value: 'all', label: t('sub2All'), count: inSub1.length }, ...sorted(bySub2)],
      },
    ].filter((group) => group.options.length > 1);
  }, [initialCameras, selectedCategory, selectedSub1, selectedSub2, t]);

  /* Picking a facet resets the narrower ones: a `sub2` left behind from another
     branch of the catalogue silently empties the list. */
  const pickFacet = (group: string, value: string) => {
    if (group === 'cat') return updateWikiParam({ cat: value, sub1: 'all', sub2: 'all' });
    if (group === 'sub1') return updateWikiParam({ sub1: value, sub2: 'all' });
    return updateWikiParam({ sub2: value });
  };

  // Filtering & Sorting
  const filteredCameras = useMemo(() => {
    let result = [...initialCameras];

    if (selectedCategory !== 'all') {
      result = result.filter((c) => c.category === selectedCategory);
    }

    if (selectedSub1 !== 'all') {
      result = result.filter((c) => c.subCategory1 === selectedSub1);
    }

    if (selectedSub2 !== 'all') {
      result = result.filter((c) => c.subCategory2 === selectedSub2);
    }

    if (searchQuery.trim()) {
      result = result
        .map((c) => ({
          camera: c,
          score: calculateMatchScore(searchQuery, [
            c.name,
            c.fullName,
            c.sku,
            c.subCategory1,
            c.subCategory2,
            ...splitFeatures(c.features).en,
            ...splitFeatures(c.features).vi,
          ]),
        }))
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .map((item) => item.camera);
    }

    // Same comparator the server list uses, so the order cannot change under
    // the reader when this re-sorts after hydration.
    result.sort(compareCameras(sortBy));

    return result;
  }, [initialCameras, selectedCategory, selectedSub1, selectedSub2, searchQuery, sortBy]);

  const toggleCompare = (id: string) => {
    setSelectedForCompare((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      }
      if (prev.length >= 6) {
        return prev;
      }
      return [...prev, id];
    });
  };

  const comparedCameraObjects = useMemo(() => {
    return initialCameras.filter((c) => selectedForCompare.includes(c.id));
  }, [initialCameras, selectedForCompare]);

  const navigateToComparePage = () => {
    if (selectedForCompare.length === 0) return;
    setIsConfirmModalOpen(false);
    /* One compare surface for both catalogues, so a reader can put a body and
       a headset side by side. It resolves ids against cameras *and* audio. */
    router.push(`/cameras/compare?ids=${selectedForCompare.join(',')}`);
  };

  const hasActiveWikiFilters = selectedCategory !== 'all' || selectedSub1 !== 'all' || selectedSub2 !== 'all' || Boolean(searchQuery);

  /* What the reader is looking at, in the catalogue's own words — the same
     three axes the rail draws, read back as one label above the title. */
  const trail = [
    selectedCategory === 'all' ? t('catAll') : t(CATEGORY_LABEL_KEY[selectedCategory] ?? 'catAll'),
    ...(selectedSub1 !== 'all' ? [selectedSub1] : []),
    ...(selectedSub2 !== 'all' ? [selectedSub2] : []),
  ];

  const pageTitle = basePath === '/audio' ? t('audioTitle') : t('title');

  /** One product's spec chips: the identifiers first, then its own bullets. */
  const chipsFor = (cam: CameraCard) =>
    [cam.sku, cam.subCategory1, cam.subCategory2, ...featureList(cam.features, locale)].filter(
      (chip): chip is string => Boolean(chip),
    );

  return (
    <div className="w-full grid gap-6 lg:grid-cols-[268px_minmax(0,1fr)] lg:gap-8">
      {/* Facet rail — the catalogue's own axes, as a fill-selected list. */}
      <aside className="bg-white/[0.03] rounded-lg p-5 flex flex-col gap-6 lg:sticky lg:top-6 lg:self-start lg:max-h-[calc(100dvh-4rem)] scroll-area">
        {facets.map((group) => (
          <div key={group.key} className="flex flex-col gap-2">
            <span className="label">{group.name}</span>
            {group.options.map((option) => {
              const isActive = group.selected === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => pickFacet(group.key, option.value)}
                  className={`flex items-center justify-between gap-2.5 text-left text-body px-3 min-h-10 pointer-coarse:min-h-[var(--layout-touch-target)] rounded-sm cursor-pointer transition-colors ${
                    isActive ? ACCENT_FILL : 'text-ink-muted hover:bg-white/[0.06]'
                  }`}
                >
                  <span className="min-w-0 truncate">{option.label}</span>
                  <span
                    className={`text-meta tabular-nums shrink-0 ${
                      isActive ? 'text-accent-200' : 'text-ink-faint'
                    }`}
                  >
                    {option.count}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </aside>

      <div className="flex flex-col gap-5 min-w-0">
        <header className="flex flex-wrap items-end justify-between gap-5">
          <div className="flex flex-col gap-2 min-w-0">
            <span className="label flex flex-wrap items-center gap-2">
              {trail.map((part, idx) => (
                <span key={`${part}-${idx}`} className="flex items-center gap-2">
                  {idx > 0 && <span aria-hidden>·</span>}
                  <span>{part}</span>
                </span>
              ))}
            </span>
            <h1 className="text-title-1 font-extrabold tracking-[-0.02em] text-ink">{pageTitle}</h1>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {selectedForCompare.length > 0 && (
              <span className="text-body-sm text-ink-muted">
                {t('compareSummary', { count: selectedForCompare.length })}
              </span>
            )}
            {hasActiveWikiFilters && (
              <button
                type="button"
                onClick={() => router.push(basePath, { scroll: false })}
                className="text-body-sm font-semibold text-accent-400 cursor-pointer"
              >
                {t('emptyAction')}
              </button>
            )}
          </div>
        </header>

        {filteredCameras.length === 0 ? (
          <div className="surface p-12 text-center flex flex-col items-center justify-center gap-3">
            <h2 className="text-title-3 font-semibold text-ink">{t('emptyTitle')}</h2>
            <button
              type="button"
              onClick={() => router.push(basePath, { scroll: false })}
              className="btn-glass cursor-pointer"
            >
              {t('emptyAction')}
            </button>
          </div>
        ) : viewMode === 'table' ? (
          /* Table view — rows separate by an alternating film, never a rule. */
          <div className="surface overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-body-sm text-ink">
                <thead className="label select-none">
                  <tr>
                    <th scope="col" className="p-4 text-center w-12 font-semibold">
                      {t('compare')}
                    </th>
                    <th scope="col" className="p-4 font-semibold">
                      {t('actionLabel')}
                    </th>
                    <th scope="col" className="p-4 font-semibold">
                      {t('skuLabel')}
                    </th>
                    <th scope="col" className="p-4 font-semibold">
                      {t('categoryLabel')}
                    </th>
                    <th scope="col" className="p-4 font-semibold">
                      {t('subCategoryLabel')}
                    </th>
                    <th scope="col" className="p-4 font-semibold">
                      {t('priceLabel')}
                    </th>
                    <th scope="col" className="p-4 min-w-[28rem] lg:min-w-[36rem] font-semibold">
                      {t('featuresLabel')}
                    </th>
                    <th scope="col" className="p-4 text-right min-w-[7rem] font-semibold">
                      {t('specUrl')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCameras.map((cam, idx) => {
                    const isChecked = selectedForCompare.includes(cam.id);
                    return (
                      <tr
                        key={cam.id}
                        className={
                          isChecked
                            ? 'bg-accent-500/15 shadow-[var(--elevation-1)]'
                            : idx % 2 === 1
                              ? 'row-tint'
                              : ''
                        }
                      >
                        {/* Checkbox for Compare */}
                        <td className="p-4 text-center">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleCompare(cam.id)}
                            aria-label={cam.name}
                            className="w-4 h-4 rounded-sm bg-sunken accent-[var(--color-accent-500)] cursor-pointer"
                          />
                        </td>

                        {/* Photo & Name (click opens the product page) */}
                        <td className="p-4">
                          <div
                            onClick={() => openProduct(cam)}
                            className="flex items-center gap-3 cursor-pointer group"
                          >
                            <div className="relative w-14 h-14 shrink-0 rounded-md overflow-hidden bg-white p-1 flex items-center justify-center">
                              {cam.imageUrl ? (
                                <Image
                                  src={cam.imageUrl}
                                  alt={cam.name}
                                  width={56}
                                  height={56}
                                  className="object-contain max-h-full"
                                />
                              ) : (
                                <NoPhoto />
                              )}
                            </div>
                            <div className="flex flex-col gap-0.5">
                              <span className="font-semibold text-body-sm text-ink group-hover:text-accent-400 transition-colors">
                                {cam.name}
                              </span>
                              <span className="meta line-clamp-1">{cam.fullName}</span>
                            </div>
                          </div>
                        </td>

                        {/* SKU Code */}
                        <td className="p-4 text-ink-muted whitespace-nowrap">
                          {cam.sku || <span className="text-ink-faint">—</span>}
                        </td>

                        {/* Main Category Badge */}
                        <td className="p-4 whitespace-nowrap">
                          <span
                            className={`px-2.5 py-1 rounded-sm text-label font-semibold shadow-[var(--elevation-spec)] ${
                              CATEGORY_TAG_CLASS[cam.category] ?? 'bg-white/[0.08] text-ink-muted'
                            }`}
                          >
                            {t(CATEGORY_LABEL_KEY[cam.category] ?? 'catAll')}
                          </span>
                        </td>

                        {/* Sub-categories */}
                        <td className="p-4 whitespace-nowrap">
                          <div className="flex flex-col gap-1">
                            <span className="text-body-sm font-semibold text-ink">{cam.subCategory1}</span>
                            {cam.subCategory2 && <span className="meta">{cam.subCategory2}</span>}
                          </div>
                        </td>

                        {/* Price */}
                        <td className="p-4 font-semibold text-accent-400 tabular-nums whitespace-nowrap">
                          {cam.priceFormatted}
                        </td>

                        {/* Features (Expanded width with word-wrap) */}
                        <td className="p-4 min-w-[28rem] lg:min-w-[36rem]">
                          <ul className="space-y-1.5 text-body-sm text-ink-muted leading-relaxed">
                            {featureList(cam.features, locale).map((feat, featIdx) => (
                              <li key={featIdx} className="flex items-start gap-2 whitespace-normal break-words">
                                <span className="text-accent-400 shrink-0 leading-none" aria-hidden>
                                  •
                                </span>
                                <span className="flex-1">{feat}</span>
                              </li>
                            ))}
                          </ul>
                        </td>

                        {/* Sony Link — absent for the audio sheets, which publish none. */}
                        <td className="p-4 text-right whitespace-nowrap">
                          {cam.url ? (
                            <a
                              href={cam.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-body-sm font-semibold text-accent-400 transition-colors"
                            >
                              Sony ↗
                            </a>
                          ) : (
                            <span className="text-ink-faint">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* List view — 132px photo · product · price + action, on a surface. */
          <ul className="flex flex-col gap-3">
            {filteredCameras.map((cam) => {
              const isChecked = selectedForCompare.includes(cam.id);
              return (
                <li
                  key={cam.id}
                  className={`p-4 flex flex-col gap-4 sm:grid sm:grid-cols-[132px_minmax(0,1fr)_auto] sm:gap-[22px] sm:items-center ${
                    isChecked ? ROW_SELECTED : 'surface'
                  }`}
                >
                  {/* Photo on a clean white plate (click opens the product page) */}
                  <div
                    onClick={() => openProduct(cam)}
                    className="relative h-24 w-full rounded-md bg-white p-2 flex items-center justify-center overflow-hidden cursor-pointer"
                  >
                    {cam.imageUrl ? (
                      <Image
                        src={cam.imageUrl}
                        alt={cam.name}
                        fill
                        sizes="132px"
                        className="object-contain p-2"
                      />
                    ) : (
                      <NoPhoto label={t('noPhoto')} />
                    )}
                  </div>

                  <div className="flex flex-col gap-2 min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
                      <h2 className="text-title-2 font-extrabold tracking-[-0.02em] text-ink">
                        <button
                          type="button"
                          onClick={() => openProduct(cam)}
                          className="text-left cursor-pointer hover:text-accent-400 transition-colors"
                        >
                          {cam.name}
                        </button>
                      </h2>
                      <span
                        className={`text-label font-semibold px-2.5 py-1 rounded-sm shadow-[var(--elevation-spec)] ${
                          CATEGORY_TAG_CLASS[cam.category] ?? 'bg-white/[0.08] text-ink-muted'
                        }`}
                      >
                        {t(CATEGORY_LABEL_KEY[cam.category] ?? 'catAll')}
                      </span>
                    </div>

                    <p className="meta line-clamp-1">{cam.fullName}</p>

                    {/* Specs as chips: identifiers first, then the product's own
                        bullets. The catalogue's spec block is not on the wire
                        here — a card carries no `specs`. */}
                    <div className="flex flex-wrap gap-2">
                      {chipsFor(cam).map((chip, chipIdx) => (
                        <span key={chipIdx} className={CHIP}>
                          {chip}
                        </span>
                      ))}
                    </div>

                    {cam.url && (
                      <a
                        href={cam.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-body-sm font-semibold text-accent-400 self-start"
                      >
                        Sony ↗
                      </a>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end sm:justify-start">
                    <span className="text-title-3 font-extrabold tracking-[-0.02em] tabular-nums text-ink">
                      {cam.priceFormatted}
                    </span>

                    {/* The action is a real checkbox under a fill: selection is
                        the accent gradient, never an outline. */}
                    <label
                      className={`relative flex items-center justify-center px-4 min-h-[var(--layout-touch-target)] rounded-sm text-body-sm font-semibold select-none cursor-pointer transition-colors ${
                        isChecked ? ACCENT_FILL : 'text-ink-muted hover:bg-white/[0.06]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleCompare(cam.id)}
                        className="absolute inset-0 w-full h-full m-0 appearance-none opacity-0 cursor-pointer"
                      />
                      <span>{t('compare')}</span>
                    </label>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Compare dock — a floating second layer over the list. */}
      {selectedForCompare.length > 0 && (
        <div className="fixed bottom-6 right-6 z-[9990] animate-fade-in pb-safe pr-safe">
          <div className="surface-raised p-2.5 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsConfirmModalOpen(true)}
              className="btn-accent inline-flex items-center gap-2 cursor-pointer"
            >
              <span>{t('compareBtn')}</span>
              <span className="text-meta tabular-nums bg-white/20 px-2 py-0.5 rounded-sm">
                {selectedForCompare.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedForCompare([])}
              title={t('clearCompare')}
              aria-label={t('clearCompare')}
              className="w-11 min-h-[var(--layout-touch-target)] rounded-md bg-white/[0.08] hover:bg-white/[0.13] text-ink-muted shadow-[var(--elevation-spec)] transition-colors cursor-pointer flex items-center justify-center"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Confirmation sheet before the compare page */}
      {isConfirmModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setIsConfirmModalOpen(false)}
          className="fixed inset-0 z-50 bg-void/85 backdrop-blur-[30px] flex flex-col items-center justify-center p-4 sm:p-6 select-none animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-4xl max-h-[90dvh] cursor-default"
          >
            <div className="surface-raised w-full h-full p-6 flex flex-col gap-6">
              {/* Modal Header */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <h2 className="text-title-3 font-semibold text-ink">
                    {t('compareConfirmTitle')} ({comparedCameraObjects.length})
                  </h2>
                  <p className="meta">{t('compareConfirmSub')}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsConfirmModalOpen(false)}
                  className="w-11 min-h-[var(--layout-touch-target)] rounded-md bg-white/[0.08] hover:bg-white/[0.13] text-ink-muted shadow-[var(--elevation-spec)] flex items-center justify-center transition-colors cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="seam" />

              {/* Selected Product Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 max-h-[60dvh] p-1 scroll-area">
                {comparedCameraObjects.map((cam) => (
                  <div key={cam.id} className="surface relative p-3 flex flex-col gap-2.5">
                    {/* Remove Button */}
                    <button
                      type="button"
                      onClick={() => toggleCompare(cam.id)}
                      className="absolute top-2 right-2 w-6 h-6 rounded-sm bg-white/[0.08] hover:bg-white/[0.13] text-ink-muted flex items-center justify-center text-label transition-colors cursor-pointer z-10"
                    >
                      ✕
                    </button>

                    {/* Photo on Clean WHITE Background */}
                    <div
                      onClick={() => openProduct(cam)}
                      className="relative w-full aspect-[4/3] rounded-md bg-white p-2 flex items-center justify-center overflow-hidden cursor-pointer"
                    >
                      <Image
                        src={cam.imageUrl}
                        alt={cam.name}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 16vw"
                        className="object-contain p-1"
                      />
                    </div>

                    {/* Name & SKU */}
                    <div className="flex flex-col gap-0.5">
                      <h3
                        onClick={() => openProduct(cam)}
                        className="font-semibold text-body-sm text-ink line-clamp-2 leading-snug cursor-pointer"
                      >
                        {cam.name}
                      </h3>
                      <span className="meta truncate">{cam.sku}</span>
                      <span className="text-body-sm font-semibold text-accent-400 tabular-nums mt-0.5">
                        {cam.priceFormatted}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="seam" />

              {/* Footer Action Bar */}
              <div className="flex items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedForCompare([]);
                    setIsConfirmModalOpen(false);
                  }}
                  className="text-body-sm font-semibold text-ink-muted hover:text-ink transition-colors cursor-pointer"
                >
                  {t('clearCompare')}
                </button>

                <button
                  type="button"
                  onClick={navigateToComparePage}
                  className="btn-accent cursor-pointer"
                >
                  {t('compareItemsBtn', { count: selectedForCompare.length })}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

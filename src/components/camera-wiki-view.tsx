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

/* `ROW_SELECTED` lived here — the accent-tinted fill behind a selected LIST
   row. §03 replaced the rows with cards and selection now shows only in the
   card's action pill, so the recipe went with the rows rather than staying
   behind as a treatment nothing applies. */

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

/**
 * The card's subgroup eyebrow, tinted by the product line it belongs to.
 *
 * Keyed on `subCategory2`, the catalogue's own value, and mapped to the signal
 * ramp rather than to the reference's literals — `#8A9CFF` is `accent-400`,
 * `#AE8DF5` is `proposal`, `#5FC7D6` is `community`. Anything the catalogue
 * names that is not one of the three falls back to `ink-muted`, which is what
 * the reference does for DSC: a line without a signal is not given one.
 */
const SUBGROUP_TINT: Record<string, string> = {
  'Máy ảnh Alpha': 'text-accent-400',
  'Cinema Line': 'text-proposal',
  Vlog: 'text-community',
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

/**
 * A catalogue photograph that degrades to the no-photo mark when the file does
 * not load.
 *
 * A missing `imageUrl` was already handled; a PRESENT but dead one was not, and
 * that is the case the catalogue actually has. 18 of its 94 products fail to
 * load today: 17 point at `www.sony.com.vn`, which answers 403 to anything that
 * is not its own page — a browser user-agent and a matching referer do not help
 * — and one B&H id has been withdrawn (it 404s at its original path too, so the
 * size rewrite is not what broke it). Those 18 rendered a broken-image box on a
 * white plate, which reads as a bug in the page rather than a gap in the source.
 *
 * `onError` is the only signal available: whether a remote image decoded is not
 * knowable at render time, and the failures are per-URL rather than per-host, so
 * there is nothing to branch on up front.
 */
function ProductPhoto({
  src,
  alt,
  sizes,
  className,
  label,
  size,
}: {
  src: string | null | undefined;
  alt: string;
  /** Required unless `size` is given — `fill` needs it to pick a variant. */
  sizes?: string;
  className: string;
  label?: string;
  /** Fixed square instead of `fill`, for the table view's 56px thumbnail. */
  size?: number;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) return <NoPhoto label={label} />;

  if (size) {
    return (
      <Image
        src={src}
        alt={alt}
        width={size}
        height={size}
        className={className}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      className={className}
      onError={() => setFailed(true)}
    />
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

  /**
   * The facet groups flattened into one horizontal rail.
   *
   * §03 dropped the 268px sidebar, so the two axes a reader actually filters by
   * — the product line (`sub2`: Máy ảnh Alpha / Cinema Line / Vlog / DSC) and
   * the sensor size (`sub1`: Full Frame / APS-C / 1-Inch) — become chips above
   * the grid, led by an "all" chip that clears both.
   *
   * `cat` leads the rail, and that is not the reference's shape by accident.
   * The reference screen is the 31-body camera catalogue, where every chip is a
   * camera line or a sensor size. This route carries the whole Sony catalogue —
   * 94 products across cameras, lenses, accessories and audio — so flattening
   * `sub1`/`sub2` across all of them put "Adapter", "Power" and "Battery" in a
   * row beside "Full Frame", which are not the same kind of thing at all.
   *
   * Leading with the category restores the reference's set: pick Máy ảnh and
   * the narrower chips become exactly Full Frame · APS-C · 1-Inch · Máy ảnh
   * Alpha · Cinema Line · Vlog · DSC, because `facets` already narrows `sub1`
   * to the chosen category and `sub2` to the chosen `sub1`.
   *
   * Counts are not printed. The reference shows bare labels, and the original
   * spec's rule stands: show a count only where the query supplies one — the
   * sidebar had room to be honest about that, a 40px chip does not.
   */
  const facetRail = useMemo(() => {
    const isAll = selectedCategory === 'all' && selectedSub1 === 'all' && selectedSub2 === 'all';
    const order = ['cat', 'sub1', 'sub2'];

    return [
      { group: 'cat', value: 'all', label: t('catAll'), active: isAll },
      ...facets
        .slice()
        .sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key))
        .flatMap((group) =>
          group.options
            .filter((o) => o.value !== 'all')
            .map((o) => ({
              group: group.key,
              value: o.value,
              label: o.label,
              active: group.selected === o.value,
            })),
        ),
    ];
  }, [facets, selectedCategory, selectedSub1, selectedSub2, t]);

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

  return (
    <div className="w-full flex flex-col gap-6">
      <div className="flex flex-col gap-[26px] min-w-0">
        <header className="flex flex-wrap items-end justify-between gap-6">
          <div className="flex flex-col gap-[11px] min-w-0">
            <span className="label flex flex-wrap items-center gap-2">
              {trail.map((part, idx) => (
                <span key={`${part}-${idx}`} className="flex items-center gap-2">
                  {idx > 0 && <span aria-hidden>·</span>}
                  <span>{part}</span>
                </span>
              ))}
            </span>
            <h1 className="text-display font-extrabold tracking-[-0.02em] leading-[1.12] text-ink">
              {pageTitle}
            </h1>
            <p className="text-body-lg text-ink-muted max-w-[58ch] leading-[1.5] text-pretty">
              {t('catalogueLede', { count: filteredCameras.length })}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {selectedForCompare.length > 0 && (
              <>
                <span className="text-body-sm text-ink-muted">
                  {t('compareSummary', { count: selectedForCompare.length })}
                </span>
                <button
                  type="button"
                  onClick={() => setIsConfirmModalOpen(true)}
                  className="btn-accent cursor-pointer"
                >
                  {t('openCompare')}
                </button>
              </>
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

        {/* The catalogue's own axes, as one silent rail instead of a 268px
            column. Same treatment as the recipe gallery's filter row: 13px/600,
            radius 12, 40px, active = accent fill, and the scrollbar never shown
            — a rail that advertises overflow reads as a broken table. */}
        {facetRail.length > 1 && (
          <div className="scroll-silent flex gap-[9px] overflow-x-auto pb-0.5">
            {facetRail.map((chip) => (
              <button
                key={`${chip.group}:${chip.value}`}
                type="button"
                aria-pressed={chip.active}
                onClick={() => pickFacet(chip.group, chip.value)}
                className={`flex-none flex items-center text-label font-semibold px-[15px] min-h-10 rounded-sm cursor-pointer transition-colors ${
                  chip.active ? ACCENT_FILL : 'text-ink-muted hover:bg-white/[0.08]'
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>
        )}

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
                              <ProductPhoto
                                src={cam.imageUrl}
                                alt=""
                                size={56}
                                className="object-contain max-h-full"
                              />
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
          /* Card grid — structurally the recipe card (§01): radius 26, glass +
             elevation 1, a 210px photograph on top, body padding 19/20/22 at
             gap 11. The row treatment §03 used to have is gone with the
             sidebar; selection now shows only in the card's action pill.

             Four columns at `xl`, not the reference's three. The reference is
             drawn at a fixed 1440 frame; this page runs full-bleed to
             `max-w-[160rem]`, so three columns left a 400px-wide card and a lot
             of air. It steps 1 / 2 / 3 / 4 so the card never drops below the
             ~240px its 210px photograph and three chips need. */
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filteredCameras.map((cam) => {
              const isChecked = selectedForCompare.includes(cam.id);
              /* The card fill is lifted off `.surface`'s 5% film to a flat 18%
                 — at 5% over `void` the card and the page read as the same tone
                 and the grid lost its edges. Everything else in the elevation
                 (radius, blur, level-1 shadow, specular) still comes from
                 `.surface`; only the film changes.

                 `bg-none` is not optional. `.surface` paints its film with the
                 `background` shorthand, so the fill is a `background-image`
                 gradient — a `bg-*` utility sets `background-color`, which
                 paints *behind* that gradient and would never be seen. Clear
                 the image first, then colour.

                 The film is `bg-white/[0.18]`, not `bg-[oklch(100%_0_0_/_0.18)]`.
                 Tailwind reads the slash in an arbitrary value as the opacity
                 modifier, so the oklch form parses as garbage and emits **no
                 rule at all** — the class sits in the markup, the card stays at
                 5%, and nothing errors. `bg-white/[0.18]` is also what the
                 compare tray's buttons below already use. */
              return (
                <li
                  key={cam.id}
                  className="surface bg-none bg-white/[0.18] overflow-hidden flex flex-col"
                >
                  {/* Catalogue photography is shot on white, so the plate stays
                      opaque white — a translucent surface behind it would put a
                      white rectangle inside a dark one. */}
                  <button
                    type="button"
                    onClick={() => openProduct(cam)}
                    aria-label={cam.name}
                    className="relative h-[210px] w-full bg-white flex items-center justify-center overflow-hidden cursor-pointer"
                  >
                    <ProductPhoto
                      src={cam.imageUrl}
                      alt=""
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                      className="object-contain p-5"
                      label={t('noPhoto')}
                    />
                  </button>

                  <div className="flex flex-col gap-[11px] px-5 pt-[19px] pb-[22px] flex-1">
                    <span
                      className={`label ${SUBGROUP_TINT[cam.subCategory2] ?? 'text-ink-muted'}`}
                    >
                      {cam.subCategory2 || t(CATEGORY_LABEL_KEY[cam.category] ?? 'catAll')}
                    </span>

                    <h2 className="text-title-3 font-semibold leading-tight text-ink">
                      <button
                        type="button"
                        onClick={() => openProduct(cam)}
                        className="text-left cursor-pointer hover:text-accent-400 transition-colors"
                      >
                        {cam.name}
                      </button>
                    </h2>

                    {/* The three figures the catalogue publishes for this body,
                        projected onto the card server-side so the 45KB spec
                        block stays off the wire. A figure the source does not
                        state is absent, never an empty chip. */}
                    {cam.specChips.length > 0 && (
                      <div className="flex flex-wrap gap-[7px]">
                        {cam.specChips.map((chip, chipIdx) => (
                          <span key={chipIdx} className={CHIP}>
                            {chip}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* `flex-wrap` with a nowrap price: a 9-digit figure like
                        153.153.818 đ must never break mid-number. */}
                    <div className="mt-auto pt-[3px] flex flex-wrap items-center justify-between gap-x-3 gap-y-2.5">
                      <span className="text-body-lg font-extrabold tracking-[-0.02em] tabular-nums text-ink whitespace-nowrap">
                        {cam.priceFormatted}
                      </span>

                      <label
                        className={`relative flex items-center justify-center whitespace-nowrap px-3.5 min-h-10 rounded-sm text-body-sm font-semibold select-none cursor-pointer transition-colors ${
                          isChecked ? ACCENT_FILL : 'text-ink-muted hover:bg-white/[0.08]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleCompare(cam.id)}
                          className="absolute inset-0 w-full h-full m-0 appearance-none opacity-0 cursor-pointer"
                        />
                        <span>{isChecked ? t('compareSelected') : t('compare')}</span>
                      </label>
                    </div>
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
                      <ProductPhoto
                        src={cam.imageUrl}
                        alt=""
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

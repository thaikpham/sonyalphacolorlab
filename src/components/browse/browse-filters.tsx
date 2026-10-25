import { getTranslations } from 'next-intl/server';
import { CHIP_IDLE, CHIP_SELECTED } from '@/components/chip-styles';
import { Link } from '@/i18n/navigation';
import type { CameraOption } from '@/lib/cameras/my-camera';
import { FORMAT_LABELS, RECIPE_FORMATS } from '@/lib/camera/constants';
import { browseHref, hasBrowseFilters, type BrowseFilters, type Facets } from '@/lib/recipes/browse';
import { SITUATIONS, STYLES, TONES } from '@/lib/recipes/taxonomy';
import { CameraPicker } from './camera-picker';

/**
 * The quick-filter row: Colour system · Situation · Style · Tone, as links.
 *
 * The colour system comes first because it is the one choice the camera
 * forces: a body without Creative Look cannot use half the catalogue. Its
 * chips are Sony's menu names (`FORMAT_LABELS`), never translated.
 *
 * A server component rendering `<Link>`s, not buttons with a router: the row
 * works before hydration and with JS off, every state has one address, and
 * Back walks the reader out through the chips they pressed. Only the header's
 * search box is client code.
 *
 * Each chip carries the count of what pressing it yields (`facetCounts`): its
 * own group released, the other three and the query applied. A chip that would
 * yield nothing is left out rather than dimmed — except the one that is
 * selected, which must stay to be unselected. Pressing a selected chip
 * releases it; there is no "All" chip per group because the row with nothing
 * selected already is "all".
 *
 * Under 48rem each group is one silently scrolling row (`.filter-scroll`), so
 * four groups cost four lines on a phone rather than a screen of chips.
 *
 * Above them, the reader's camera (ADR 0006). It is not a filter and not a
 * link: it is a preference kept in a cookie, so it has no address, "Clear
 * filters" leaves it alone, and the counts below already reflect it.
 */
export async function BrowseFilterRow({
  filters,
  facets,
  total,
  cameras,
  camera,
}: {
  filters: BrowseFilters;
  facets: Facets;
  total: number;
  cameras: readonly CameraOption[];
  camera: { readonly choice: string; readonly name: string | null } | null;
}) {
  const [t, tHome, tCamera] = await Promise.all([
    getTranslations('browse'),
    getTranslations('home'),
    getTranslations('myCamera'),
  ]);

  const groups = [
    {
      key: 'format' as const,
      label: t('system'),
      ids: RECIPE_FORMATS,
      counts: facets.formats as Readonly<Record<string, number>>,
      name: (id: string) => FORMAT_LABELS[id as keyof typeof FORMAT_LABELS],
      selected: filters.format,
    },
    {
      key: 'situation' as const,
      label: t('situation'),
      ids: SITUATIONS,
      counts: facets.situations as Readonly<Record<string, number>>,
      name: (id: string) => t(`situations.${id}`),
      selected: filters.situation,
    },
    {
      key: 'style' as const,
      label: t('style'),
      ids: STYLES,
      counts: facets.styles as Readonly<Record<string, number>>,
      name: (id: string) => t(`styles.${id}`),
      selected: filters.style,
    },
    {
      key: 'tone' as const,
      label: t('tone'),
      ids: TONES,
      counts: facets.tones as Readonly<Record<string, number>>,
      name: (id: string) => t(`tones.${id}`),
      selected: filters.tone,
    },
  ];

  return (
    <nav aria-label={t('filtersLabel')} className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
        <span className="label shrink-0 sm:w-32 sm:leading-11">{tCamera('label')}</span>
        <CameraPicker options={cameras} current={camera} />
      </div>

      {groups.map((g) => {
        const chips = g.ids
          .filter((id) => g.counts[id] > 0 || g.selected === id)
          .map((id) => {
            const selected = g.selected === id;
            const next = { ...filters, [g.key]: selected ? null : id } as BrowseFilters;
            return { id, selected, href: browseHref(next), label: g.name(id), count: g.counts[id] };
          });
        if (chips.length === 0) return null;
        return (
          <div key={g.key} className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
            {/* 8rem: "COLOUR SYSTEM" is 119px at the label's tracking, and in
                the old 7rem column it broke onto a second 44px line. The
                count line below indents by the same 8rem. */}
            <span className="label shrink-0 sm:w-32 sm:leading-11">{g.label}</span>
            <ul className="filter-scroll flex flex-wrap items-center gap-2 min-w-0">
              {chips.map((c) => (
                <li key={c.id} className="shrink-0">
                  <Link
                    href={c.href}
                    aria-current={c.selected ? 'true' : undefined}
                    className={c.selected ? CHIP_SELECTED : CHIP_IDLE}
                  >
                    {c.label}
                    <span className={`tabular-nums ${c.selected ? 'text-accent-200' : 'text-ink-faint'}`}>
                      {c.count}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        );
      })}

      <div className="flex items-center gap-4 sm:pl-[calc(8rem+0.75rem)]">
        <span className="meta tabular-nums">{tHome('resultCount', { count: total })}</span>
        {hasBrowseFilters(filters) ? (
          <Link href="/colorlab" className="text-body-sm font-semibold text-accent-400 underline underline-offset-2">
            {t('clear')}
          </Link>
        ) : null}
      </div>
    </nav>
  );
}

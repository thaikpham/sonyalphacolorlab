'use client';

import { useRouter } from '@/i18n/navigation';
import { CREATIVE_LOOKS } from '@/lib/camera/constants';

export type ActiveFilters = { format?: string; look?: string; tag?: string };

export type FilterLabels = {
  format: string;
  look: string;
  tags: string;
  all: string;
};

/**
 * Filters are client-enhanced links: the URL carries them with in-place router push,
 * so filtered views are shareable/indexable without resetting scroll or page reload.
 */
function href(active: ActiveFilters, patch: ActiveFilters) {
  const next: Record<string, string> = {};
  for (const [k, v] of Object.entries({ ...active, ...patch })) if (v) next[k] = v;
  const qs = new URLSearchParams(next).toString();
  return qs ? `/?${qs}` : '/';
}

function Chip({
  children,
  to,
  on,
  isDimmed = false,
}: {
  children: React.ReactNode;
  to: string;
  on: boolean;
  isDimmed?: boolean;
}) {
  const router = useRouter();

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    router.push(to, { scroll: false });
  };

  return (
    <a
      href={to}
      onClick={handleClick}
      aria-current={on ? 'true' : undefined}
      className={`eyebrow inline-flex items-center rounded-full px-3 py-1.5 transition-all duration-300 ease-out cursor-pointer ${
        on
          ? '!text-void bg-ink scale-105 shadow-[0_0_14px_rgba(255,255,255,0.4)] font-bold'
          : isDimmed
          ? 'glass-flat opacity-35 scale-95 hover:opacity-100 hover:scale-100 !text-ink-muted'
          : 'glass-flat hover:!text-ink !text-ink-muted'
      }`}
    >
      {children}
    </a>
  );
}

export function FilterBar({
  active,
  tags,
  labels,
}: {
  active: ActiveFilters;
  tags: { tag: string; count: number }[];
  labels: FilterLabels;
}) {
  const hasActiveTag = Boolean(active.tag);
  const hasActiveFormat = Boolean(active.format);
  const hasActiveLook = Boolean(active.look);

  return (
    <div className="flex flex-col gap-3">
      {/* Format Filter Bar */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="eyebrow mr-1 hidden sm:inline">{labels.format}</span>
        <Chip
          to={href(active, { format: undefined, look: undefined })}
          on={!active.format}
          isDimmed={hasActiveFormat}
        >
          {labels.all}
        </Chip>
        <Chip
          to={href(active, { format: 'pp', look: undefined })}
          on={active.format === 'pp'}
          isDimmed={hasActiveFormat && active.format !== 'pp'}
        >
          Picture Profile
        </Chip>
        <Chip
          to={href(active, { format: 'cl' })}
          on={active.format === 'cl'}
          isDimmed={hasActiveFormat && active.format !== 'cl'}
        >
          Creative Look
        </Chip>
      </div>

      {/* Look codes only make sense once Creative Look is selected */}
      {active.format === 'cl' && (
        <div className="flex flex-wrap items-center gap-2 transition-all duration-300">
          <span className="eyebrow mr-1 hidden sm:inline">{labels.look}</span>
          <Chip
            to={href(active, { look: undefined })}
            on={!active.look}
            isDimmed={hasActiveLook}
          >
            {labels.all}
          </Chip>
          {CREATIVE_LOOKS.map((l) => (
            <Chip
              key={l.code}
              to={href(active, { look: l.code })}
              on={active.look === l.code}
              isDimmed={hasActiveLook && active.look !== l.code}
            >
              {l.code}
            </Chip>
          ))}
        </div>
      )}

      {/* Tags Filter Bar with Smooth Dimming & Highlight Animations */}
      <div className="filter-scroll flex flex-wrap items-center gap-2">
        <span className="eyebrow mr-1 hidden sm:inline">{labels.tags}</span>
        <Chip
          to={href(active, { tag: undefined })}
          on={!active.tag}
          isDimmed={hasActiveTag}
        >
          {labels.all}
        </Chip>
        {tags.map((t) => (
          <Chip
            key={t.tag}
            to={href(active, { tag: t.tag })}
            on={active.tag === t.tag}
            isDimmed={hasActiveTag && active.tag !== t.tag}
          >
            {t.tag}
          </Chip>
        ))}
      </div>
    </div>
  );
}

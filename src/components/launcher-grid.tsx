'use client';

import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import { LAUNCHER_GLOW } from '../../packages/colorlab-tokens/src/tokens';
import { ECOSYSTEM_APPS, type EcosystemAppDef } from '@/lib/ecosystem';

/**
 * The ecosystem launcher — the one sanctioned exception in the design system.
 *
 * Squircle tiles carrying a rotating seven-colour spectral glow: the only
 * multi-hue gradient, the only rotating animation and the only radius outside
 * the scale anywhere in the ecosystem. The recipe itself lives in globals.css
 * (`.launcher-*`) so there is exactly one place to delete it from if it ever
 * gets reused somewhere else and stops being a signature.
 *
 * The seven hues come from LAUNCHER_GLOW in the token package rather than being
 * retyped here, and are handed to the stylesheet as one custom property. A
 * conic gradient needs its stops as a single comma-separated string, and the
 * first hue repeats at the end so the wheel closes without a seam.
 */
const SPECTRUM = [...LAUNCHER_GLOW, LAUNCHER_GLOW[0]].join(', ');

type Props = {
  onNavigate?: () => void;
};

/**
 * One tile size, everywhere.
 *
 * The landing page and the header's ecosystem overlay used to render this
 * component at two different sizes — `lg` and `md` — and the two drifted: the
 * overlay's tiles stopped at 96px while the page's went to 132px, so the same
 * three apps were two different objects depending on which door you came
 * through. There is one ramp now, held in the token package, and no prop to
 * pick a different one with.
 *
 * The widths are the old ones scaled by 1.5. The glow blurs in globals.css are
 * scaled with them — they are absolute pixels, and a halo that does not grow
 * with its tile reads as a rim.
 */
const TILE =
  'w-[var(--layout-tile-mobile)] h-[var(--layout-tile-mobile)] ' +
  'sm:w-[var(--layout-tile-tablet)] sm:h-[var(--layout-tile-tablet)] ' +
  'lg:w-[var(--layout-tile-desktop)] lg:h-[var(--layout-tile-desktop)]';

/**
 * Three apps: two columns until `md`, one row of three above it.
 *
 * The switch used to be at `sm`. Three tiles fit across a 640px screen at the
 * old 112px; at 168px they do not — 3 × 168 plus two 40px gaps is 584px, and
 * the overlay pays 40px of padding on each side of a 640px viewport, leaving
 * 560px. The tile cannot shrink to fit without dropping the type under the
 * 13px floor, so the third tile wraps to its own row instead. Same reasoning
 * that put the phone breakpoint at two columns, applied at the size above it.
 *
 * `sm:max-w-[460px]` is what keeps that wrap from reading as a mistake. The
 * columns are `1fr`, so an uncapped grid spreads two tiles across the full
 * 3xl and parks the orphaned third under the far left with half the row
 * empty beside it. On a phone the grid is already about as wide as the tiles
 * and the question never comes up; at 700px it does. The cap is scoped to
 * `sm` alone — `md:max-w-3xl` hands the full width back the moment all three
 * fit on one row.
 *
 * The space between tiles is mostly the column, not the gap: each tile is
 * centred in a `1fr` track, so the visible gutter is `(width + gap) / 3 - tile`
 * and a wider gap alone buys a third of itself. That is why the widths move
 * with the gaps. At `md` the grid is width-bound by the viewport (768 less the
 * overlay's 80 is 688px), and 3 × 168 + 2 × 64 = 632 still fits; at `lg`,
 * `max-w-4xl` (896px) inside 944px gives a ~127px gutter between 198px tiles.
 *
 * Written out in full rather than derived from another string. Tailwind v4
 * scans source text for class names: a class assembled at runtime is one the
 * scanner never sees, so it emits no rule for it. Same trap as the inline
 * `min-[2100px]:` form that silently never changed a column count.
 */
const GRID =
  'grid w-full max-w-3xl sm:max-w-[460px] md:max-w-3xl lg:max-w-4xl grid-cols-2 md:grid-cols-3 ' +
  'items-start justify-items-center gap-x-10 gap-y-12 sm:gap-x-14 sm:gap-y-14 md:gap-x-16 lg:gap-x-20';

/**
 * One tile: two glow layers behind an opaque icon face.
 *
 * The face must stay opaque. The spectrum reads as light escaping from behind
 * the tile; the moment it tints the artwork it stops being a signature and
 * becomes a filter over the apps' icons.
 */
function Tile({ app }: { app: EcosystemAppDef }) {
  return (
    <>
      <div
        className={`launcher-tile ${TILE}`}
        style={{ '--launcher-spectrum': SPECTRUM } as React.CSSProperties}
      >
        <span aria-hidden className="launcher-glow" />
        <span aria-hidden className="launcher-glow-rim" />
        <div className={`launcher-face ${app.iconInset}`}>
          <Image
            src={app.icon}
            alt=""
            width={200}
            height={200}
            unoptimized
            className="w-full h-full object-contain"
          />
        </div>
      </div>
      {/* 13px at the mobile tile size is the floor, 15px above it. The name
          recedes by weight and ink step, never by dropping under 13. */}
      <span className="text-meta sm:text-body font-semibold text-ink text-center leading-tight">
        <span className="sm:hidden">{app.shortName}</span>
        <span className="hidden sm:inline">{app.name}</span>
      </span>
    </>
  );
}

/**
 * Every tile opens its app. No tile opens a second screen of tiles.
 *
 * Sony Wiki used to be the exception: tapping it swapped the grid for a DI/PE
 * sub-view, so reaching a camera page cost two taps and a back button that had
 * to be positioned around `.animate-fade-in`'s transform. The two divisions are
 * one app with two catalogues, not two apps, so the switch between them now
 * lives where the rest of that app's controls live — beside the search field in
 * `site-header.tsx`. The tile lands on `/cameras` like any other tile lands on
 * its app.
 */
export function LauncherGrid({ onNavigate }: Props) {
  const shell =
    'launcher-link group flex flex-col items-center gap-3 sm:gap-4 text-center ' +
    'max-w-[240px] min-h-[var(--layout-touch-target)] cursor-pointer';

  return (
    <div className="w-full flex flex-col items-center justify-center">
      <div className={`${GRID} animate-fade-in`}>
        {ECOSYSTEM_APPS.map((app) => {
          const tile = <Tile app={app} />;

          if (app.external) {
            return (
              <a
                key={app.key}
                href={app.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => onNavigate && setTimeout(onNavigate, 200)}
                className={shell}
              >
                {tile}
              </a>
            );
          }

          return (
            <Link key={app.key} href={app.href} onClick={onNavigate} className={shell}>
              {tile}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

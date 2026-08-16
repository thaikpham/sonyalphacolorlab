'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { LAUNCHER_GLOW } from '../../packages/colorlab-tokens/src/tokens';
import { ECOSYSTEM_APPS, WIKI_DIVISIONS, type EcosystemAppDef } from '@/lib/ecosystem';

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
  /** `lg` on the landing page, `md` inside the header overlay. */
  size?: 'md' | 'lg';
  onNavigate?: () => void;
};

/**
 * Two columns below 640px, three to 1023px, one row on desktop. There are four
 * apps, so `lg:grid-cols-4` is the "one row" the reference asks for — a flex
 * row wraps unpredictably at the in-between widths.
 *
 * Both grids are written out in full rather than derived from one another.
 * The sub-grid used to be `GRID.replace('lg:grid-cols-4', 'lg:grid-cols-2')`,
 * and Tailwind v4 scans source text for class names: a class assembled at
 * runtime is one the scanner never sees, so it emits no rule for it. Same trap
 * as the inline `min-[2100px]:` form that silently never changed a column
 * count. It happened to work only because `lg:grid-cols-2` is written
 * literally in an unrelated file.
 */
const GRID =
  'grid w-full max-w-3xl grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 ' +
  'items-start justify-items-center gap-x-6 gap-y-8 sm:gap-x-10 sm:gap-y-10 lg:gap-x-[52px]';

/** The Sony Wiki divisions: two tiles, so two columns from `sm` up. */
const SUB_GRID =
  'grid w-full max-w-3xl grid-cols-2 ' +
  'items-start justify-items-center gap-x-6 gap-y-8 sm:gap-x-10 sm:gap-y-10 lg:gap-x-[52px]';

/**
 * One tile: two glow layers behind an opaque icon face.
 *
 * The face must stay opaque. The spectrum reads as light escaping from behind
 * the tile; the moment it tints the artwork it stops being a signature and
 * becomes a filter over four different brands' icons.
 */
function Tile({ app, size }: { app: EcosystemAppDef; size: 'md' | 'lg' }) {
  const box =
    size === 'lg'
      ? 'w-[76px] h-[76px] sm:w-28 sm:h-28 lg:w-[var(--layout-tile-desktop)] lg:h-[var(--layout-tile-desktop)]'
      : 'w-[76px] h-[76px] sm:w-24 sm:h-24';

  return (
    <>
      <div
        className={`launcher-tile ${box}`}
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

export function LauncherGrid({ size = 'lg', onNavigate }: Props) {
  const [subView, setSubView] = useState<'main' | 'sonywiki'>('main');
  const t = useTranslations('launcher');

  const shell =
    'launcher-link group flex flex-col items-center gap-3 sm:gap-4 text-center ' +
    'max-w-[240px] min-h-[var(--layout-touch-target)] cursor-pointer';

  const handleWikiClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setSubView('sonywiki');
  };

  return (
    <div className="w-full flex flex-col items-center justify-center">
      {subView === 'main' ? (
        <div className={`${GRID} animate-fade-in`}>
          {ECOSYSTEM_APPS.map((app) => {
            const tile = <Tile app={app} size={size} />;

            if (app.key === 'wiki') {
              return (
                <button key={app.key} type="button" onClick={handleWikiClick} className={shell}>
                  {tile}
                </button>
              );
            }

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
      ) : (
        /* Sony Wiki's two divisions: Digital Imaging and Personal
           Entertainment. Same tile language, no second glow treatment — these
           are inside the exception, not a new one. */
        <div className="flex flex-col items-center justify-center w-full max-w-3xl gap-8">
          {/* OUTSIDE the fading panel below, and deliberately.
              `.animate-fade-in` leaves a transform on its element, which makes
              it the containing block for any `fixed` descendant — this button
              resolved `top-5 left-5` against the panel, landed on top of the DI
              tile, and its z-index meant every click meant for DI hit "back"
              instead. It is chrome, not content: it does not fade with the
              tiles, and it is a sibling so `fixed` means the viewport. */}
          <button
            type="button"
            onClick={() => setSubView('main')}
            className="btn-glass fixed top-5 left-5 sm:top-8 sm:left-8 z-20 gap-2 cursor-pointer"
          >
            <span aria-hidden className="text-accent-400">
              ←
            </span>
            <span>{t('back')}</span>
          </button>

          <div className={`${SUB_GRID} animate-fade-in`}>
            {WIKI_DIVISIONS.map((division) => (
              <Link
                key={division.key}
                href={division.href}
                onClick={onNavigate}
                className={shell}
              >
                <div
                  className="launcher-tile w-[76px] h-[76px] sm:w-28 sm:h-28 lg:w-[var(--layout-tile-desktop)] lg:h-[var(--layout-tile-desktop)]"
                  style={{ '--launcher-spectrum': SPECTRUM } as React.CSSProperties}
                >
                  <span aria-hidden className="launcher-glow" />
                  <span aria-hidden className="launcher-glow-rim" />
                  <div className="launcher-face">
                    <span className="text-title-1 font-extrabold text-ink select-none">
                      {division.mark}
                    </span>
                  </div>
                </div>
                <span className="text-meta sm:text-body font-semibold text-ink text-center leading-tight">
                  {division.name}
                </span>
                <span className="meta">{t(`divisions.${division.key}`)}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

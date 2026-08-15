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

  /* Two columns below 640px, three to 1023px, one row on desktop. The tile
     count is four, so `sm:grid-cols-4` is the "one row" the reference asks
     for — a flex row would wrap unpredictably at the in-between widths. */
  const grid =
    'grid w-full max-w-3xl grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 ' +
    'items-start justify-items-center gap-x-6 gap-y-8 sm:gap-x-10 sm:gap-y-10 lg:gap-x-[52px]';

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
        <div className={`${grid} animate-fade-in`}>
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
        <div className="flex flex-col items-center justify-center w-full max-w-3xl gap-8 animate-fade-in">
          <button
            type="button"
            onClick={() => setSubView('main')}
            className="btn-glass fixed top-5 left-5 sm:top-8 sm:left-8 z-[100000] inline-flex items-center gap-2 cursor-pointer"
          >
            <span aria-hidden className="text-accent-400">
              ←
            </span>
            <span>{t('back')}</span>
          </button>

          <div className={grid.replace('lg:grid-cols-4', 'lg:grid-cols-2')}>
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

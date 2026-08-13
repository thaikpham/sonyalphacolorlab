import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import type { EcosystemAppDef } from '@/lib/ecosystem';

/**
 * One app tile in the Sony Alpha ecosystem launcher.
 *
 * Rendered by two surfaces: the overlay in `site-header.tsx` (a Client
 * Component, which passes `onNavigate` to close itself) and the landing page at
 * `/` (a Server Component, which passes nothing). This file has no `'use
 * client'` and no hooks on purpose — that is what lets both use it, and it
 * keeps the landing page from dragging a client bundle in for four links.
 *
 * Three elements, and the split matters. The **shell** owns every transform —
 * the staggered entrance and the hover scale. The **glow** is its own absolutely
 * positioned layer *behind* the tile rather than a `z-index: -1` pseudo on the
 * tile, because a negative-z child only paints behind its parent while that
 * parent is not a stacking context: the moment the tile itself scaled on hover
 * it became one, and the blurred rainbow painted across the icon's face instead
 * of around it. The **tile** is the opaque squircle and does the clipping.
 *
 * Nothing here clips the shell's overflow — the glow lives outside the tile's
 * box by design, and `overflow-hidden` anywhere above it cuts away the only
 * part of it that is ever visible.
 */
export function EcosystemApp({
  app,
  onNavigate,
  size = 'md',
}: {
  app: EcosystemAppDef;
  onNavigate?: () => void;
  /** `lg` is the landing page, which has a whole screen to spend. */
  size?: 'md' | 'lg';
}) {
  const tile =
    size === 'lg'
      ? 'w-32 h-32 sm:w-40 sm:h-40 lg:w-48 lg:h-48'
      : 'w-32 h-32 sm:w-40 sm:h-40';
  const label =
    size === 'lg'
      ? 'text-[1rem] sm:text-lg lg:text-xl'
      : 'text-[1rem] sm:text-lg';

  const body = (
    <>
      <div className={`app-tile-shell ${tile} mb-4`}>
        <span aria-hidden className="app-glow" />
        <div className={`app-tile w-full h-full ${app.iconInset} flex items-center justify-center`}>
          <Image
            src={app.icon}
            /* Decorative: the visible name below is already the link's label,
               and a duplicate here would have a screen reader read it twice. */
            alt=""
            width={200}
            height={200}
            /* Served straight from /public, never through /_next/image.
               These broke in production with
               `402 OPTIMIZED_IMAGE_REQUEST_PAYMENT_REQUIRED` — the account's
               image-optimization quota is spent, so only transforms already in
               Vercel's cache still resolve. Every other image on the site kept
               working purely because it had been optimized before the quota
               ran out; these were added after it, so no cached variant existed
               and all of them rendered as broken icons.
               The sources are 256x256 and 6-11KB each, which is smaller than
               the optimizer's own output would have been, so there is nothing
               left to optimize away. This also makes the launcher immune to the
               quota, which is the point: it is the one component whose whole job
               is to look like the apps work. */
            unoptimized
            className="w-full h-full object-contain"
          />
        </div>
      </div>
      <h2
        className={`${label} font-bold text-white transition-colors tracking-wide drop-shadow-md ${app.accent ?? ''}`}
      >
        {app.name}
      </h2>
    </>
  );

  const shell = `group app-enter ${app.enter} flex flex-col items-center text-center max-w-[240px] cursor-pointer`;

  if (app.external) {
    return (
      <a
        href={app.href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onNavigate ? () => setTimeout(onNavigate, 200) : undefined}
        className={shell}
      >
        {body}
      </a>
    );
  }

  return (
    <Link href={app.href} onClick={onNavigate} className={shell}>
      {body}
    </Link>
  );
}

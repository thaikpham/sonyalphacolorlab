'use client';

import type { ReactNode } from 'react';
import { Link } from '@/i18n/navigation';
import { WIKI_DIVISIONS } from '@/lib/ecosystem';

type Props = {
  /** The division currently open — a `WIKI_DIVISIONS` href, so `/cameras` or `/audio`. */
  current: string;
  /** Which width this mount point is for. The two are responsive opposites. */
  className?: string;
};

/** Glyph beside each mark: a camera for DI, headphones for PE. Decorative — the link's `aria-label` already names the division. */
const DIVISION_ICONS: Record<(typeof WIKI_DIVISIONS)[number]['key'], ReactNode> = {
  di: (
    <>
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <circle cx="12" cy="13" r="3" />
    </>
  ),
  pe: (
    <>
      <path d="M3 14v-2a9 9 0 0 1 18 0v2" />
      <path d="M21 16a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 16a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
    </>
  ),
};

/**
 * DI / PE — Sony Wiki's division switch.
 *
 * It used to be a second screen of launcher tiles: the Sony Wiki tile swapped
 * the grid for two more tiles, so the division was chosen before the app had
 * rendered anything to choose by, and changing it meant going back out to the
 * launcher. DI and PE are two catalogues inside one app, not two apps, so the
 * switch belongs among that app's own controls.
 *
 * It mounts in TWO places, and the reason is arithmetic rather than taste. The
 * rail in `site-header.tsx` is where it belongs — directly left of the search
 * field whose scope it changes — but at 375px that rail is already full to the
 * pixel: 44px launcher, 44px search, a 113px signed-out Sign in and an 83px
 * language toggle come to exactly the 311px a phone has, with the wordmark
 * already crushed to nothing. Adding 78px there cost the Sony Wiki logo and
 * clipped DI off the left edge. So the header mounts it from `sm` up, and the
 * catalogue's own facet rail in `camera-wiki-view.tsx` mounts it below `sm`,
 * where it leads the row of category chips and has room to be a real 44px
 * target. Never both at once: the two `className`s are exact opposites.
 *
 * Links, not buttons. Each division is a real route, so it has to survive a
 * middle-click, a bookmark and a shared URL; a click handler calling
 * `router.push` gives up all three.
 *
 * The href is the bare division root and deliberately carries no query string
 * across. `cat`, `sub1` and `sort` name categories that exist in one catalogue
 * and not the other, so a filter dragged through the switch would either empty
 * the grid or quietly come to mean something else. Same reason the reset button
 * lands on the app index rather than rebuilding filters.
 *
 * 44px overall: `p-0.5` around a `min-h-10` option, so on the header rail the
 * control matches the 44px touch target exactly rather than standing 4px proud
 * of it the way the console's view switcher does — that one sits in the filter
 * bar, which sets its own height.
 */
export function WikiDivisionSwitch({ current, className = '' }: Props) {
  return (
    <div className={`surface-sunken shrink-0 items-center gap-1 p-0.5 ${className}`}>
      {WIKI_DIVISIONS.map((division) => {
        const isCurrent = division.href === current;
        return (
          <Link
            key={division.key}
            href={division.href}
            title={division.name}
            aria-label={division.name}
            aria-current={isCurrent ? 'page' : undefined}
            className={`flex min-h-10 items-center gap-1.5 rounded-sm px-2.5 text-label font-semibold transition-colors sm:px-3 ${
              isCurrent ? 'surface-selected text-ink' : 'text-ink-muted hover:text-ink'
            }`}
          >
            <svg
              aria-hidden="true"
              className="h-4 w-4 shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {DIVISION_ICONS[division.key]}
            </svg>
            {division.mark}
          </Link>
        );
      })}
    </div>
  );
}

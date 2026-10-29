'use client';

import type { ReactNode } from 'react';
import type { CameraRows } from '@/lib/cameras/my-camera';
import { useMyCameraChoice } from './my-camera-warning';

/**
 * The row of other recipes for the same situation, under a recipe page,
 * narrowed to what the reader's camera can install (ADR 0006).
 *
 * The page is prerendered, so it cannot read the cookie: it works out every
 * choice's row at build (`cameraRows`), renders each card any row shows on
 * the server, and this island picks the row for the browser's cookie. The
 * server render and the first client render are no camera's row — the same
 * six as before there was a camera, so the static HTML and the row's height
 * do not move — and a value the map does not hold is no camera. A camera that
 * can install none of them draws no section.
 */
export function MoreForSituation({
  heading,
  cards,
  rows,
}: {
  /** The section's `h2`, `id="more-for-situation"`, rendered by the page. */
  heading: ReactNode;
  /** One server-rendered `RecipeCard` per id in `rows.shown`. */
  cards: Readonly<Record<string, ReactNode>>;
  rows: Pick<CameraRows, 'row' | 'byChoice'>;
}) {
  const choice = useMyCameraChoice();
  /* `Object.hasOwn`: a cookie reading `constructor` must not find the prototype's. */
  const ids = choice && Object.hasOwn(rows.byChoice, choice) ? rows.byChoice[choice] : rows.row;
  if (ids.length === 0) return null;
  return (
    <section aria-labelledby="more-for-situation" className="mt-16 flex flex-col gap-4">
      {heading}
      <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {ids.map((id) => (
          /* `grid` stretches the card to the row's height: a name that wraps
             to three lines no longer leaves its neighbour short. */
          <li key={id} className="grid">
            {cards[id]}
          </li>
        ))}
      </ul>
    </section>
  );
}

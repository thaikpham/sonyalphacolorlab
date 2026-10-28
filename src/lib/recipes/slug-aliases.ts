/**
 * Every spelling a recipe's slug has had.
 *
 * Slugs moved to the code and the name of the day on 2026-10-24
 * (`pp-001-vivid-nostalgia-film`), and stay there while names are computed
 * from the settings (2026-10-28), and the slug each
 * recipe was first published under is kept in `data/former-slugs.json`
 * (former → current), which `seed:emit` writes and nothing edits by hand.
 *
 * Both spellings stay live for good, in both directions, because the two
 * databases change at different times and neither time is known to the code:
 *
 * - the **content** plane's slugs change when the owner applies its migration
 *   by hand — after this code deploys, never before (the code it replaces
 *   reads neither the new ids nor the new slugs);
 * - the **control** plane's `recipe_slug` columns change when the PR merges;
 * - and a comment, proposal or photo written while the two disagree is stored
 *   under whichever spelling the page was read with (S9).
 *
 * So a route that looks a recipe up by slug tries every alias
 * (`slug-resolve.ts`), and every community read matches
 * `.in('recipe_slug', slugAliases(slug))`. Writes keep the slug the request
 * names — so the one key that spans a single spelling, the gallery's unique
 * `(recipe_slug, image_url)`, is backed by a lookup across every spelling
 * before each photo insert (`photoInGallery` in `community/gallery.ts`).
 *
 * Client-safe: one small JSON import and nothing else.
 */

import formerSlugs from '../../../data/former-slugs.json';

const CURRENT_BY_FORMER: ReadonlyMap<string, string> = new Map(Object.entries(formerSlugs as Record<string, string>));
const FORMER_BY_CURRENT: ReadonlyMap<string, string> = new Map(
  [...CURRENT_BY_FORMER].map(([former, current]) => [current, former]),
);

/** The current slug of a former one — `mojave-sun` → `pp-001-vivid-nostalgia-film` — or null. */
export const currentSlugOf = (slug: string): string | null => CURRENT_BY_FORMER.get(slug) ?? null;

/** The former slug of a current one — the reverse of `currentSlugOf` — or null. */
export const formerSlugOf = (slug: string): string | null => FORMER_BY_CURRENT.get(slug) ?? null;

/**
 * The slug as asked, then its other spelling, deduplicated: what a lookup
 * must try so a recipe answers under either. A slug the map does not know is
 * only itself.
 */
export function slugAliases(slug: string): readonly string[] {
  const other = currentSlugOf(slug) ?? formerSlugOf(slug);
  return other && other !== slug ? [slug, other] : [slug];
}

/**
 * Whether sending `from` to `to` may be cached for good.
 *
 * Only the map's own direction, former → current: that is where every
 * recipe ends up. The other direction — a current slug sent back to the
 * former one because the content migration has not run yet — is temporary:
 * a browser that cached it as a 308 would loop for ever once the migration
 * sends the former slug forward again.
 */
export const isPermanentMove = (from: string, to: string): boolean => currentSlugOf(from) === to;

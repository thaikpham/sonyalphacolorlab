/**
 * Every spelling a recipe's slug has had.
 *
 * A seed recipe has three: the slug it was first published under
 * (`mojave-sun`), the code and the name of 2026-10-24
 * (`pp-001-vivid-nostalgia-film`), and the code alone since 2026-10-28
 * (`pp-001`). The histories come from the frozen batches in `slug-moves.ts`,
 * which both planes' migrations carry pair for pair.
 *
 * Every spelling stays live for good, in every direction, because the two
 * databases change at different times and neither time is known to the code:
 *
 * - the **content** plane's slugs change when the owner applies its migration
 *   by hand — after this code deploys, never before;
 * - the **control** plane's `recipe_slug` columns change when the PR merges;
 * - and a comment, proposal or photo written while the two disagree is stored
 *   under whichever spelling the page was read with.
 *
 * So a route that looks a recipe up by slug tries every alias
 * (`slug-resolve.ts`), and every community read matches
 * `.in('recipe_slug', slugAliases(slug))`. Writes keep the slug the request
 * names — so the one key that spans a single spelling, the gallery's unique
 * `(recipe_slug, image_url)`, is backed by a lookup across every spelling
 * before each photo insert (`photoInGallery` in `community/gallery.ts`).
 *
 * Client-safe: two small JSON imports and nothing else.
 */

import { recordedHistories } from './slug-moves';

const HISTORIES = recordedHistories();

/** Every spelling of the recipe `slug` is one of, oldest first; a slug in no history is only itself. */
export const slugHistory = (slug: string): readonly string[] =>
  HISTORIES.get(slug)?.map((s) => s.slug) ?? [slug];

/** The newest spelling of a slug's recipe — `mojave-sun` → `pp-001` — or the slug itself. */
export const newestSlugOf = (slug: string): string => slugHistory(slug).at(-1)!;

/**
 * The slug as asked, then every other spelling of its recipe, newest first:
 * what a lookup must try so a recipe answers under any. A slug no history
 * knows is only itself.
 */
export function slugAliases(slug: string): readonly string[] {
  return [slug, ...slugHistory(slug).filter((s) => s !== slug).reverse()];
}

/**
 * Whether sending `from` to `to` may be cached for good: only when both are
 * spellings of one recipe and `from` is the older. That is the direction every
 * database ends up going. The other — a newer slug sent back to the one a
 * content plane that has not run its migration still holds — is temporary: a
 * browser that cached it as a 308 would loop for ever once the migration sends
 * the older slug forward again.
 */
export function isPermanentMove(from: string, to: string): boolean {
  const history = HISTORIES.get(from);
  if (!history || history !== HISTORIES.get(to)) return false;
  return history.findIndex((s) => s.slug === from) < history.findIndex((s) => s.slug === to);
}

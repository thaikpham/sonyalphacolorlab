import { readFileSync } from 'node:fs';

import { RETIRED_REPLACED_BY } from './retired';

export { RETIRED_RECIPE_IDS } from './retired';

/** Every earlier spelling → the code slug, as `seed:emit` writes it. */
const FORMER_SLUGS = JSON.parse(readFileSync('data/former-slugs.json', 'utf8')) as Record<string, string>;

/**
 * The same table with each replacement at its code slug.
 *
 * Kept here, beside the map that reads it, so the share links that still
 * carry these ids keep answering. The destination follows the replacement
 * the moment the seed says it is published (P6); until then it is the
 * catalogue. A replacement slug the map does not know is a stale table and
 * throws at load, rather than sending a link to a slug no recipe has.
 */
export const RETIRED_LEGACY_IDS: Readonly<Record<string, string | null>> = Object.fromEntries(
  Object.entries(RETIRED_REPLACED_BY).map(([legacyId, former]) => {
    if (former === null) return [legacyId, null];
    const current = FORMER_SLUGS[former];
    if (!current) throw new Error(`RETIRED_REPLACED_BY: ${legacyId} names ${former}, which data/former-slugs.json does not map`);
    return [legacyId, current];
  }),
);

/**
 * Legacy redirects.
 *
 * sonycolorlab.app was a single-page app that addressed recipes with a **query
 * parameter**, not a path — `recipe-service.js` did
 * `newUrl.searchParams.set('id', ...)`, and the share button built
 * `origin + ?id=<recipeId>`. So every link already shared in Facebook groups
 * looks like `https://sonycolorlab.app/?id=scl-001`, never `/recipe/scl-001`.
 *
 * A path-based redirect map would therefore have caught nothing.
 *
 * These only fire for traffic that reaches this app, so at cutover the old
 * hostname must resolve here (or carry an equivalent rule at the CDN).
 *
 * Each destination is the seed's slug, the recipe's code (`/recipe/pp-001`).
 * A content project that has not had its slug migrations yet still holds an
 * earlier spelling, and the recipe route resolves that (`slug-resolve.ts`), so
 * a `?id=` link lands in every state.
 *
 * A withdrawn id redirects too, and TEMPORARILY (307) while its destination is
 * the catalogue: a 308 is cached by the browser for good, and the destination
 * changes to the replacement recipe once that is published. The permanent
 * status returns with the recipe.
 *
 * Its own module, imported by `next.config.ts`, so `redirects.test.ts` can run
 * the map itself rather than grep the config — loading the config would also
 * load the next-intl plugin. No `@/` alias and nothing beyond `node:`: the
 * config loader resolves this file before any bundler is involved.
 */
export function legacyRedirects() {
  const recipes = JSON.parse(readFileSync('data/recipes.seed.json', 'utf8')) as {
    slug: string;
    legacyId: string | null;
    published: boolean;
  }[];
  const published = new Set(recipes.filter((r) => r.published).map((r) => r.slug));

  const live = recipes
    .filter((r): r is { slug: string; legacyId: string; published: boolean } => Boolean(r.legacyId))
    .map((r) => ({
      source: '/',
      has: [{ type: 'query' as const, key: 'id', value: r.legacyId }],
      destination: `/recipe/${r.slug}`,
      permanent: true,
    }));

  const retired = Object.entries(RETIRED_LEGACY_IDS).map(([legacyId, slug]) => {
    const replaced = slug !== null && published.has(slug);
    return {
      source: '/',
      has: [{ type: 'query' as const, key: 'id', value: legacyId }],
      destination: replaced ? `/recipe/${slug}` : '/colorlab',
      permanent: replaced,
    };
  });

  return [...live, ...retired];
}

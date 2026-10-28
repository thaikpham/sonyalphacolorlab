import { readFileSync } from 'node:fs';

/**
 * The Picture Profiles withdrawn on 2026-10-23 — each legacy id and the slug
 * of the original cooked to the same purpose, or null where nothing replaces
 * it (three experiments). Ids only, no settings: the reason they are gone is
 * "withdrawn: matches a licensed third-party collection", and a public
 * repository is the last place to keep their numbers.
 *
 * Written in the slugs the originals were first published under; the
 * replacement's code slug (`pp-058`) is read through `data/former-slugs.json`
 * below, so the table is never retyped when a slug moves.
 */
const RETIRED_REPLACED_BY: Readonly<Record<string, string | null>> = {
  'scl-003': 'neon-night',
  'scl-004': 'cho-lon-slide',
  'scl-005': 'da-lat-mist',
  'scl-006': 'da-lat-mist',
  'scl-007': 'cho-lon-slide',
  'scl-008': 'clear-day',
  'scl-010': 'ha-noi-winter',
  'scl-011': 'neon-night',
  'scl-012': 'ho-tay-golden',
  'scl-013': 'mekong-noon',
  'scl-014': 'tam-coc-green',
  'scl-016': 'clear-day',
  'scl-017': 'hue-silk',
  'scl-018': 'vung-tau-pop',
  'scl-019': 'vung-tau-pop',
  'scl-020': 'ha-noi-winter',
  'scl-021': 'da-lat-mist',
  'scl-022': 'linen-editorial',
  'scl-023': 'moc-chau-frost',
  'scl-024': 'moc-chau-frost',
  'scl-026': 'mui-ne-dusk',
  'scl-028': 'hoi-an-lantern',
  'scl-029': 'sai-gon-cafe',
  'scl-030': 'old-quarter-mono',
  'scl-031': 'hem-noir',
  'scl-032': 'hem-noir',
  'scl-033': 'pearl-mono',
  'scl-034': 'old-quarter-mono',
  'scl-035': 'old-quarter-mono',
  'scl-036': 'hem-noir',
  'scl-037': 'late-night-mono',
  'scl-038': 'pearl-mono',
  'scl-039': null,
  'scl-040': null,
  'scl-041': null,
  'scl-043': 'tam-coc-green',
};

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
 * The withdrawn recipes' catalogue ids, for the content-plane script: the
 * legacy number in the code shape (`scl-003` → `PP-003`), like every other
 * row once the content migration has run (S4).
 */
export const RETIRED_RECIPE_IDS: readonly string[] = Object.keys(RETIRED_LEGACY_IDS).map(
  (legacyId) => `PP-${legacyId.slice(4)}`,
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

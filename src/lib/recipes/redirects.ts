import { readFileSync } from 'node:fs';

/**
 * The Picture Profiles withdrawn on 2026-10-23 — each legacy id and the slug
 * of the original cooked to the same purpose, or null where nothing replaces
 * it (three experiments). Ids only, no settings: the reason they are gone is
 * "withdrawn: matches a licensed third-party collection", and a public
 * repository is the last place to keep their numbers.
 *
 * Kept here, beside the map that reads it, so the share links that still
 * carry these ids keep answering. The destination follows the replacement
 * the moment the seed says it is published (P6); until then it is the
 * catalogue.
 */
export const RETIRED_LEGACY_IDS: Readonly<Record<string, string | null>> = {
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

/** The withdrawn recipes' catalogue ids, for the content-plane script. */
export const RETIRED_RECIPE_IDS: readonly string[] = Object.keys(RETIRED_LEGACY_IDS).map(
  (legacyId) => `SCL-PP-${legacyId.slice(4)}`,
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

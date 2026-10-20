import { readFileSync } from 'node:fs';

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
 * Its own module, imported by `next.config.ts`, so `redirects.test.ts` can run
 * the map itself rather than grep the config — loading the config would also
 * load the next-intl plugin. No `@/` alias and nothing beyond `node:`: the
 * config loader resolves this file before any bundler is involved.
 */
export function legacyRedirects() {
  const recipes = JSON.parse(readFileSync('data/recipes.seed.json', 'utf8')) as {
    slug: string;
    legacyId: string | null;
  }[];

  return recipes
    .filter((r): r is { slug: string; legacyId: string } => Boolean(r.legacyId))
    .map((r) => ({
      source: '/',
      has: [{ type: 'query' as const, key: 'id', value: r.legacyId }],
      destination: `/recipe/${r.slug}`,
      permanent: true,
    }));
}

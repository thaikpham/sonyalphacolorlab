import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The one response that could outlive a cache invalidation.
 *
 * Product and article saves now call `revalidateTag(..., IMMEDIATE)`, which
 * clears the Data Cache the catalogue reads live in. It cannot clear a copy a
 * CDN is already holding. This route sent `s-maxage=60,
 * stale-while-revalidate=300`, so for up to six minutes after a rename the page
 * showed the new name and the search box kept offering the old one — the exact
 * "my save did not take" report the whole invalidation change exists to end.
 *
 * Dropping it costs nothing: the catalogue read underneath is still cached and
 * still tagged, so a keystroke reaches the handler without reaching Postgres.
 */
describe('the predictive search response', () => {
  const source = readFileSync('src/app/api/search/predictive/route.ts', 'utf8');

  it('is never cached by a shared cache', () => {
    expect(source).not.toMatch(/s-maxage/);
    expect(source).not.toMatch(/stale-while-revalidate/);
    expect(source).toMatch(/const CACHE_CONTROL = 'no-store'/);
  });

  it('still reads the catalogue through the tagged cache', () => {
    /* The point of the change is to stop caching the *response*, not to start
       hitting the database on every keystroke. The route delegates to the
       unified service, which reads the same cached functions the pages do. */
    expect(source).toContain('searchContent(');
    const service = readFileSync('src/lib/search/service.ts', 'utf8');
    expect(service).toMatch(/getSonyCameras\(\)/);
    expect(service).toMatch(/listRecipes\(locale\)/);
    expect(service).not.toMatch(/contentRead|contentAdmin|from\('/);
  });
});

describe('the unified search response', () => {
  const route = readFileSync('src/app/api/search/route.ts', 'utf8');

  it('is never cached by a shared cache either', () => {
    expect(route).toMatch(/const CACHE_CONTROL = 'no-store'/);
    expect(route).not.toMatch(/s-maxage|stale-while-revalidate/);
  });

  it('validates the request before reading anything', () => {
    expect(route.indexOf('safeParse(')).toBeGreaterThan(-1);
    expect(route.indexOf('safeParse(')).toBeLessThan(route.indexOf('searchContent('));
  });
});

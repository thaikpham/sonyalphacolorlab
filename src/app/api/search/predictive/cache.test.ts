import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

/* The service is a stand-in so the route can be called without a catalogue.
   The source assertions below read files, which this does not affect. */
const searchContent = vi.fn();
vi.mock('@/lib/search/service', () => ({ searchContent: (...args: unknown[]) => searchContent(...args) }));

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

describe('the predictive response during a source outage', () => {
  it('passes on what the service could not search', async () => {
    /* The route used to return `hits` alone, so a content-plane outage reached
       the header as an empty list and read "No instant matches." — the empty
       group that service.ts says must never stand in for a failure. */
    searchContent.mockResolvedValueOnce({ hits: [], unavailable: ['product'] });
    const { GET } = await import('./route');
    const res = await GET(new Request('http://x/api/search/predictive?q=a7&mode=wiki'));
    expect(await res.json()).toMatchObject({ results: [], unavailable: ['product'] });
  });

  it('reports nothing unavailable when nothing was searched', async () => {
    const { GET } = await import('./route');
    const res = await GET(new Request('http://x/api/search/predictive?q='));
    expect(await res.json()).toMatchObject({ results: [], unavailable: [] });
  });
});

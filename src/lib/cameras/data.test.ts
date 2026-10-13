import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getSonyCameras } from './data';

/**
 * The catalogue is parsed once and held in a module-level cache, which is what
 * makes every catalogue read on a page cheap. That cache is shared by every
 * request the process serves, so anything handed out of it has to be treated as
 * borrowed rather than owned.
 *
 * `sort` mutates in place. `filter` returns a new array, so a *filtered* read
 * was always safe — but a read with no filters returned the cache itself, and
 * sorting that reordered the catalogue for every later request in the process.
 * The symptom is the kind that never reproduces locally: one visitor asks for
 * `?sort=name`, and from then on the unsorted catalogue is alphabetical for
 * everyone, until the next deploy.
 *
 * These run against the seed (no Supabase credentials in test), which is
 * exactly the path that aliases the cache.
 */
describe('getSonyCameras cache safety', () => {
  it('does not let a sorted read reorder later unsorted reads', async () => {
    const before = (await getSonyCameras()).map((c) => c.id);

    await getSonyCameras({ sortBy: 'name' });
    await getSonyCameras({ sortBy: 'sku' });
    await getSonyCameras({ sortBy: 'price-asc' });

    const after = (await getSonyCameras()).map((c) => c.id);
    expect(after, 'default catalogue order changed after a sorted read').toEqual(before);
  });

  it('does not hand out the same array twice', async () => {
    /* Two callers holding one array is the precondition for the bug above.
       Even if neither sorts today, a future one will. */
    const a = await getSonyCameras({ sortBy: 'name' });
    const b = await getSonyCameras({ sortBy: 'name' });
    expect(a).not.toBe(b);
  });

  it('still sorts correctly', async () => {
    /* Only the priced rows are compared: `priceVnd: 0` means the catalogue
       publishes no figure, and those deliberately sort last rather than first.
       See `compareCameras` and `wiki-sort.test.ts`. */
    const byPriceAsc = await getSonyCameras({ sortBy: 'price-asc' });
    const prices = byPriceAsc.filter((c) => c.priceVnd > 0).map((c) => c.priceVnd);
    expect(prices.length).toBeGreaterThan(0);
    expect([...prices].sort((x, y) => x - y)).toEqual(prices);

    const byName = await getSonyCameras({ sortBy: 'name' });
    const names = byName.map((c) => c.name);
    expect([...names].sort((x, y) => x.localeCompare(y))).toEqual(names);
  });

  it('filters without disturbing the cached order', async () => {
    const before = (await getSonyCameras()).map((c) => c.id);
    const lenses = await getSonyCameras({ category: 'lens' });
    expect(lenses.length).toBeGreaterThan(0);
    expect(lenses.every((c) => c.category === 'lens')).toBe(true);
    expect((await getSonyCameras()).map((c) => c.id)).toEqual(before);
  });
});

/**
 * A whole-table catalogue read is cached under its arguments — `unstable_cache`
 * makes them part of the key. So a route handler that forwards a query string
 * into one turns every distinct `?search=` into a cache miss, a full
 * `sony_cameras` read against the content project and a fresh Data Cache entry.
 * The public `/api/cameras` did exactly that, unauthenticated and unbounded,
 * and nothing in the app called it. The pages call these with no arguments and
 * filter what comes back; a route must do the same.
 */
describe('catalogue reads in route handlers', () => {
  const WHOLE_TABLE = ['getSonyCameras', 'getSonyAudio', 'listSlugs'];

  function routes(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return routes(path);
      return entry.name === 'route.ts' ? [path] : [];
    });
  }

  it.each(routes('src/app'))('%s passes no request value into a cached whole-table read', (path) => {
    const source = readFileSync(path, 'utf8');
    for (const name of WHOLE_TABLE) {
      expect(source, `${name} is called with arguments`).not.toMatch(
        new RegExp(`\\b${name}\\(\\s*[^)\\s]`),
      );
    }
  });
});

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getSonyCameras } from './data';
import { compareCameras } from './types';

/**
 * The catalogue is parsed once and held in a module-level cache, which is what
 * makes every catalogue read on a page cheap. That cache is shared by every
 * request the process serves, so anything handed out of it has to be treated as
 * borrowed rather than owned.
 *
 * `sort` mutates in place. The reader used to take a `sortBy` option and sort
 * the cache itself, so one visitor asking for `?sort=name` made the catalogue
 * alphabetical for everyone until the next deploy. The options are gone — no
 * page passed them — and ordering is `compareCameras` over a copy, which is
 * what the grid does. These pin that shape.
 *
 * These run against the seed (no Supabase credentials in test), which is
 * exactly the path that aliases the cache.
 */
describe('getSonyCameras cache safety', () => {
  it('takes no options, in either catalogue', () => {
    /* Nothing to sort the cache with, and nothing to split the cache key on. */
    expect(readFileSync('src/lib/cameras/data.ts', 'utf8')).toMatch(/async function _getSonyCameras\(\): Promise/);
    expect(readFileSync('src/lib/audio/data.ts', 'utf8')).toMatch(/async function _getSonyAudio\(\): Promise/);
  });

  it('does not let a sorted copy reorder later reads', async () => {
    const before = (await getSonyCameras()).map((c) => c.id);

    [...(await getSonyCameras())].sort(compareCameras('name'));
    [...(await getSonyCameras())].sort(compareCameras('price-asc'));

    const after = (await getSonyCameras()).map((c) => c.id);
    expect(after, 'default catalogue order changed after a sorted read').toEqual(before);
  });

  it('sorts correctly over a copy', async () => {
    /* Only the priced rows are compared: `priceVnd: 0` means the catalogue
       publishes no figure, and those deliberately sort last rather than first.
       See `compareCameras` and `wiki-sort.test.ts`. */
    const byPriceAsc = [...(await getSonyCameras())].sort(compareCameras('price-asc'));
    const prices = byPriceAsc.filter((c) => c.priceVnd > 0).map((c) => c.priceVnd);
    expect(prices.length).toBeGreaterThan(0);
    expect([...prices].sort((x, y) => x - y)).toEqual(prices);

    const byName = [...(await getSonyCameras())].sort(compareCameras('name'));
    const names = byName.map((c) => c.name);
    expect([...names].sort((x, y) => x.localeCompare(y))).toEqual(names);
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

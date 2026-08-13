import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getSonyCameras } from './data';
import { compareCameras, DEFAULT_WIKI_SORT, type WikiSort } from './types';

/**
 * The wiki's default ordering is agreed on by two components and used for three
 * different decisions: what to sort by, whether `?sort=` belongs in the URL, and
 * whether the filter bar counts as "active".
 *
 * It used to be five copies of `'price-desc'` across those files, and copies
 * only work while they all agree. Change one and the app contradicts itself in
 * a way that looks like a bug in the control rather than a typo: the default is
 * stripped from the URL under one name and read back under another, so choosing
 * the other ordering yields a URL with no `sort` param and the page snaps
 * straight back to the default. Nothing throws.
 *
 * These read the sources rather than rendering, for the same reason
 * `admin-gate.test.ts` does: the property worth pinning is that no file has
 * gone back to hardcoding the value.
 */

const SOURCES = ['src/components/camera-wiki-view.tsx', 'src/components/site-header.tsx'];

const SORTS: WikiSort[] = ['price-asc', 'price-desc', 'name', 'sku'];

describe('wiki default sort', () => {
  it('is cheapest first', () => {
    expect(DEFAULT_WIKI_SORT).toBe('price-asc');
  });

  describe.each(SOURCES)('%s', (path) => {
    const source = readFileSync(path, 'utf8');

    it('reads the shared constant', () => {
      expect(source).toContain('DEFAULT_WIKI_SORT');
    });

    it('names no ordering where a default or a comparison is meant', () => {
      /* Two places may spell an ordering out, because both are the control's
         vocabulary rather than a claim about which one is default:
           - `<option value="…">`, the list of choices offered
           - `case '…':`, the switch that applies the chosen one
         A literal anywhere else is a hardcoded default or a comparison against
         one, which is the drift this whole constant exists to prevent. */
      const vocabulary = source
        .replace(/<option value="[^"]*">/g, '')
        .replace(/case '[^']*':/g, '');
      for (const sort of SORTS) {
        expect(vocabulary, `"${sort}" is hardcoded in ${path}`).not.toContain(`'${sort}'`);
      }
    });
  });

  /** Just the sort `<select>`; the header has others whose options are `all`. */
  function sortOptions(): string[] {
    const header = readFileSync('src/components/site-header.tsx', 'utf8');
    const block = header.match(/<select\s+value=\{wikiSort\}[\s\S]*?<\/select>/);
    expect(block, 'could not find the sort <select> in site-header.tsx').not.toBeNull();
    return [...block![0].matchAll(/<option value="([^"]+)">/g)].map((m) => m[1]);
  }

  it('offers every ordering the type allows', () => {
    expect([...sortOptions()].sort()).toEqual([...SORTS].sort());
  });

  it('lists the default first, so the control matches what is on screen', () => {
    expect(sortOptions()[0]).toBe(DEFAULT_WIKI_SORT);
  });
});

describe('price ordering', () => {
  it('really does run cheapest to dearest', async () => {
    const cameras = await getSonyCameras({ sortBy: 'price-asc' });
    const prices = cameras.filter((c) => c.priceVnd > 0).map((c) => c.priceVnd);
    expect(prices.length).toBeGreaterThan(0);
    for (let i = 1; i < prices.length; i++) {
      expect(prices[i], `position ${i} is cheaper than ${i - 1}`).toBeGreaterThanOrEqual(
        prices[i - 1],
      );
    }
  });

  /**
   * `priceVnd: 0` means the catalogue publishes no figure — those rows render
   * as "Liên hệ". Sorted naively they are the two cheapest things Sony sells,
   * so cheapest-first opened the wiki with a cinema lens presented as the
   * bargain of the range. A missing price is not a price.
   */
  it.each(['price-asc', 'price-desc'] as const)('puts unpriced rows last for %s', async (sortBy) => {
    const cameras = await getSonyCameras({ sortBy });
    const unpricedAt = cameras
      .map((c, i) => (c.priceVnd > 0 ? -1 : i))
      .filter((i) => i >= 0);
    expect(unpricedAt.length, 'seed has no unpriced product to check').toBeGreaterThan(0);

    const firstUnpriced = Math.min(...unpricedAt);
    const lastPriced = cameras.reduce((acc, c, i) => (c.priceVnd > 0 ? i : acc), -1);
    expect(firstUnpriced, 'an unpriced row sorts above a priced one').toBeGreaterThan(lastPriced);
  });

  it('orders the two sides consistently for a mixed list', () => {
    const rows = [
      { name: 'C', sku: 'c', priceVnd: 300 },
      { name: 'A', sku: 'a', priceVnd: 0 },
      { name: 'B', sku: 'b', priceVnd: 100 },
    ];
    expect([...rows].sort(compareCameras('price-asc')).map((r) => r.name)).toEqual(['B', 'C', 'A']);
    expect([...rows].sort(compareCameras('price-desc')).map((r) => r.name)).toEqual(['C', 'B', 'A']);
    expect([...rows].sort(compareCameras('name')).map((r) => r.name)).toEqual(['A', 'B', 'C']);
  });
});

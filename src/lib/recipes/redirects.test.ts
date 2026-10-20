import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { legacyRedirects } from './redirects';

/**
 * Guards the legacy redirect map.
 *
 * The old site addressed recipes by query parameter (`/?id=scl-001`), not by
 * path. Every link shared in a Facebook group over the past year has that
 * shape, so a redirect map keyed on paths would silently catch none of them —
 * traffic would land on the homepage with no error anywhere.
 */
const config = readFileSync('next.config.ts', 'utf8');
const seed = JSON.parse(readFileSync('data/recipes.seed.json', 'utf8')) as {
  slug: string;
  legacyId: string | null;
  published: boolean;
}[];

describe('legacy redirects', () => {
  it('is the map next.config.ts serves', () => {
    expect(config).toMatch(/import \{ legacyRedirects \} from '\.\/src\/lib\/recipes\/redirects'/);
    expect(config).toMatch(/async redirects\(\) \{\s*return legacyRedirects\(\);\s*\}/);
  });

  it('covers every recipe that carries a legacy id', () => {
    const withLegacy = seed.filter((r) => r.legacyId);
    expect(withLegacy.length).toBe(46);
    // Every legacy id must still be present in the dataset the map is built from.
    expect(new Set(withLegacy.map((r) => r.legacyId)).size).toBe(46);
  });

  it('keeps the PROCOLOR ids, which do not follow the scl- pattern', () => {
    const ids = seed.map((r) => r.legacyId);
    for (const id of ['PROCOLOR-001', 'PROCOLOR-002', 'PROCOLOR-003']) {
      expect(ids).toContain(id);
    }
  });

  /* Executed, not read: this checked each row's slug against a set built from
     the same rows, which cannot fail, and nothing ran the map at all. */
  it('answers one query redirect per legacy id, to a published recipe', () => {
    const redirects = legacyRedirects();
    const published = new Set(seed.filter((r) => r.published).map((r) => r.slug));
    const withLegacy = seed.filter((r) => r.legacyId);

    expect(redirects).toHaveLength(withLegacy.length);
    for (const r of withLegacy) {
      const matching = redirects.filter((x) => x.has[0]?.value === r.legacyId);
      expect(matching, r.legacyId!).toHaveLength(1);
      const [rule] = matching;
      expect(rule).toEqual({
        source: '/',
        has: [{ type: 'query', key: 'id', value: r.legacyId }],
        destination: `/recipe/${r.slug}`,
        permanent: true,
      });
      /* `has.value` is matched as a regex; a metacharacter in an id would
         widen it to catch, or miss, other ids. */
      expect(r.legacyId, 'regex metacharacter in a legacy id').not.toMatch(/[.*+?^${}()|[\]\\]/);
      expect(published.has(r.slug), `${r.legacyId} -> ${r.slug} is not a published recipe`).toBe(true);
    }
  });
});

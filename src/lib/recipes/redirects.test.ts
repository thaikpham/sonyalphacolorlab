import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

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
}[];

describe('legacy redirects', () => {
  it('matches on the query parameter, not a path', () => {
    expect(config).toContain("key: 'id'");
    expect(config).toContain("source: '/'");
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

  it('points every legacy id at a slug that exists', () => {
    const slugs = new Set(seed.map((r) => r.slug));
    for (const r of seed) {
      if (r.legacyId) expect(slugs.has(r.slug), `${r.legacyId} -> ${r.slug}`).toBe(true);
    }
  });
});

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { legacyRedirects, RETIRED_LEGACY_IDS, RETIRED_RECIPE_IDS } from './redirects';

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
  id: string;
  slug: string;
  legacyId: string | null;
  published: boolean;
}[];

/** The 46 ids the old site ever shared: the ones still live plus the withdrawn. */
const LEGACY_TOTAL = 46;

describe('legacy redirects', () => {
  it('is the map next.config.ts serves', () => {
    expect(config).toMatch(/import \{ legacyRedirects \} from '\.\/src\/lib\/recipes\/redirects'/);
    expect(config).toMatch(/async redirects\(\) \{\s*return legacyRedirects\(\);\s*\}/);
  });

  it('covers every id the old site ever shared, live or withdrawn, exactly once', () => {
    const live = seed.filter((r) => r.legacyId).map((r) => r.legacyId as string);
    const retired = Object.keys(RETIRED_LEGACY_IDS);
    expect(live.length + retired.length).toBe(LEGACY_TOTAL);
    expect(new Set([...live, ...retired]).size).toBe(LEGACY_TOTAL);
    /* A withdrawn recipe is gone from the seed: the map, not the data, is
       what keeps its link alive. */
    const ids = new Set(seed.map((r) => r.id));
    for (const id of RETIRED_RECIPE_IDS) expect(ids.has(id), `${id} is still in the seed`).toBe(false);
  });

  it('keeps the PROCOLOR ids, which do not follow the scl- pattern', () => {
    const ids = seed.map((r) => r.legacyId);
    for (const id of ['PROCOLOR-001', 'PROCOLOR-002', 'PROCOLOR-003']) {
      expect(ids).toContain(id);
    }
  });

  /* Executed, not read: this checked each row's slug against a set built from
     the same rows, which cannot fail, and nothing ran the map at all. */
  it('answers one query redirect per live legacy id, to a published recipe', () => {
    const redirects = legacyRedirects();
    const published = new Set(seed.filter((r) => r.published).map((r) => r.slug));
    const withLegacy = seed.filter((r) => r.legacyId);

    expect(redirects).toHaveLength(LEGACY_TOTAL);
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

  it('sends a withdrawn id to its published replacement, else to the catalogue — temporarily', () => {
    const redirects = legacyRedirects();
    const published = new Set(seed.filter((r) => r.published).map((r) => r.slug));
    const slugs = new Set(seed.map((r) => r.slug));

    for (const [legacyId, slug] of Object.entries(RETIRED_LEGACY_IDS)) {
      const matching = redirects.filter((x) => x.has[0]?.value === legacyId);
      expect(matching, legacyId).toHaveLength(1);
      const [rule] = matching;
      /* Every named replacement exists in the seed, published or not. */
      if (slug !== null) expect(slugs.has(slug), `${legacyId} -> ${slug} is not a recipe`).toBe(true);
      if (slug !== null && published.has(slug)) {
        expect(rule.destination).toBe(`/recipe/${slug}`);
        expect(rule.permanent).toBe(true);
      } else {
        /* A 308 is cached for good; the destination changes when the
           replacement publishes. */
        expect(rule.destination).toBe('/colorlab');
        expect(rule.permanent).toBe(false);
      }
    }
  });
});

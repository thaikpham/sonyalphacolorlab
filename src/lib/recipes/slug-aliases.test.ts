import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import recipesSeed from '../../../data/recipes.seed.json';
import formerSlugs from '../../../data/former-slugs.json';
import { recipeSchema, type Recipe } from '../camera/schema';
import legacyRecipes from '../legacy/recipes.legacy.js';
import { migrateAll } from '../legacy/migrate';
import { ORIGINAL_CL } from '../originals/cl';
import { ORIGINAL_PP } from '../originals/pp';
import { recipeDoc } from '../search/documents';
import { SONY_ASIA_IDS } from '../sony-asia/ids';
import { currentSlugOf, formerSlugOf, isPermanentMove, slugAliases } from './slug-aliases';
import { matchesQuery } from './source';

/**
 * The former-slug map and what reads it.
 *
 * Slugs follow the names since 2026-10-24. The content plane changes its slugs
 * when the owner applies the migration by hand, so every slug lookup has to
 * answer the same in both states: the map in both directions.
 */

const seed: Recipe[] = (recipesSeed as unknown[]).map((r) => recipeSchema.parse(r));
const map = formerSlugs as Record<string, string>;

/** The slug each source published the recipe under, by id. */
const sourceSlug = new Map<string, string>([
  ...migrateAll(legacyRecipes as Record<string, unknown>[]).ok.map((r) => [r.recipe.id, r.recipe.slug] as const),
  ...Object.values(SONY_ASIA_IDS).map((p) => [p.id, p.slug] as const),
  ...[...ORIGINAL_PP, ...ORIGINAL_CL].map((o) => [o.recipe.id, o.recipe.slug] as const),
]);

describe('data/former-slugs.json', () => {
  it('maps exactly the seed recipes whose slug changed, each from its source slug to its current one', () => {
    const changed = seed.filter((r) => sourceSlug.get(r.id) !== r.slug);
    expect(changed.length).toBeGreaterThan(0);
    for (const r of seed) expect(sourceSlug.has(r.id), `${r.id} has no source`).toBe(true);
    expect(Object.keys(map).sort()).toEqual(changed.map((r) => sourceSlug.get(r.id)!).sort());
    for (const r of changed) expect(map[sourceSlug.get(r.id)!], r.id).toBe(r.slug);
  });

  it('never names a current slug as a former one, and gives each recipe one former slug', () => {
    const current = new Set(seed.map((r) => r.slug));
    for (const former of Object.keys(map)) expect(current.has(former), former).toBe(false);
    const targets = Object.values(map);
    expect(new Set(targets).size).toBe(targets.length);
    for (const t of targets) expect(current.has(t), t).toBe(true);
  });

  it('is what emit-seed writes, not a hand-kept file', () => {
    expect(readFileSync('scripts/emit-seed.ts', 'utf8')).toContain("writeFileSync('data/former-slugs.json'");
  });
});

describe('slugAliases', () => {
  it('answers with the slug as asked, then its other spelling, in both directions', () => {
    expect(slugAliases('mojave-sun')).toEqual(['mojave-sun', 'pp-001-vivid-nostalgia-film']);
    expect(slugAliases('pp-001-vivid-nostalgia-film')).toEqual(['pp-001-vivid-nostalgia-film', 'mojave-sun']);
    expect(currentSlugOf('hue-silk')).toBe('pp-048-soft-clean-portrait');
    expect(formerSlugOf('pp-048-soft-clean-portrait')).toBe('hue-silk');
  });

  it('is only the slug itself when the map does not know it', () => {
    expect(slugAliases('editor-draft')).toEqual(['editor-draft']);
    expect(currentSlugOf('editor-draft')).toBeNull();
    expect(formerSlugOf('editor-draft')).toBeNull();
  });
});

describe('isPermanentMove', () => {
  it('is permanent only from a former slug to its current one', () => {
    expect(isPermanentMove('mojave-sun', 'pp-001-vivid-nostalgia-film')).toBe(true);
    /* The unmigrated database, sent back temporarily: a cached 308 this way
       would loop once the migration sends the former slug forward. */
    expect(isPermanentMove('pp-001-vivid-nostalgia-film', 'mojave-sun')).toBe(false);
    expect(isPermanentMove('mojave-sun', 'pp-002-jade-soft-film')).toBe(false);
  });
});

describe('search by a former slug', () => {
  const pp001 = seed.find((r) => r.id === 'PP-001')!;
  /* The same row in each state of the content plane. */
  const states = [pp001, { ...pp001, id: 'SCL-PP-001', slug: 'mojave-sun' }];

  it('finds the recipe by the name it was first published under, in either state', () => {
    for (const r of states) {
      expect(matchesQuery(r, 'mojave sun'), r.slug).toBe(true);
      expect(matchesQuery(r, 'vivid nostalgia'), r.slug).toBe(true);
      expect(matchesQuery(r, 'pp-001-vivid-nostalgia-film'.replace(/-/g, ' ')), r.slug).toBe(true);
    }
  });

  it('makes both slugs exact hits and the former one a tag', () => {
    for (const r of states) {
      const doc = recipeDoc({ ...r, wbLabel: '', description: '' }, 'en');
      expect(doc.exact, r.slug).toEqual(expect.arrayContaining(['mojavesun', 'pp001vividnostalgiafilm']));
      expect(doc.tags, r.slug).toContain('mojave sun');
    }
  });
});

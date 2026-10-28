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
import { isPermanentMove, newestSlugOf, slugAliases, slugHistory } from './slug-aliases';
import { SLUG_MOVES } from './slug-moves';
import { matchesQuery } from './source';

/**
 * The slug histories and what reads them.
 *
 * Every seed recipe's slug has had three spellings: the one it was first
 * published under, the code and name of 2026-10-24, and the code alone since
 * 2026-10-28. The content plane changes its slugs when the owner applies each
 * migration by hand, so every slug lookup has to answer the same in every
 * state: any spelling finds the others.
 */

const seed: Recipe[] = (recipesSeed as unknown[]).map((r) => recipeSchema.parse(r));
const map = formerSlugs as Record<string, string>;
const [OCT24, OCT28] = SLUG_MOVES;

/** The slug each source published the recipe under, by id. */
const sourceSlug = new Map<string, string>([
  ...migrateAll(legacyRecipes as Record<string, unknown>[]).ok.map((r) => [r.recipe.id, r.recipe.slug] as const),
  ...Object.values(SONY_ASIA_IDS).map((p) => [p.id, p.slug] as const),
  ...[...ORIGINAL_PP, ...ORIGINAL_CL].map((o) => [o.recipe.id, o.recipe.slug] as const),
]);

/** Each seed recipe's three spellings, oldest first, from the frozen batches alone. */
const spellings = seed.map((r) => {
  const first = sourceSlug.get(r.id)!;
  return { id: r.id, first, oct24: OCT24.moves[first], code: r.slug };
});

describe('data/former-slugs.json', () => {
  it('maps every earlier spelling of each seed recipe to its code slug, and nothing else', () => {
    for (const r of seed) expect(sourceSlug.has(r.id), `${r.id} has no source`).toBe(true);
    const expected: Record<string, string> = {};
    for (const s of spellings) {
      expect(s.oct24, `${s.id} moved on 2026-10-24`).toBeTruthy();
      expect(OCT28.moves[s.oct24], s.id).toBe(s.code);
      expected[s.first] = s.code;
      expected[s.oct24] = s.code;
    }
    expect(map).toEqual(expected);
  });

  it('never names a current slug as a former one, and points only at code slugs', () => {
    const current = new Set(seed.map((r) => r.slug));
    for (const former of Object.keys(map)) expect(current.has(former), former).toBe(false);
    for (const t of Object.values(map)) {
      expect(current.has(t), t).toBe(true);
      expect(t).toMatch(/^(pp|cl)-\d{3}$/);
    }
  });

  it('is what emit-seed writes, not a hand-kept file', () => {
    expect(readFileSync('scripts/emit-seed.ts', 'utf8')).toContain("writeFileSync('data/former-slugs.json'");
  });
});

describe('slugHistory', () => {
  it('gives every seed recipe its three spellings, oldest first, from any of them', () => {
    for (const s of spellings) {
      const history = [s.first, s.oct24, s.code];
      for (const slug of history) expect(slugHistory(slug), `${s.id} ${slug}`).toEqual(history);
      expect(newestSlugOf(s.first), s.id).toBe(s.code);
    }
    expect(slugHistory('mojave-sun')).toEqual(['mojave-sun', 'pp-001-vivid-nostalgia-film', 'pp-001']);
  });

  it('is only the slug itself when no batch knows it', () => {
    expect(slugHistory('editor-draft')).toEqual(['editor-draft']);
    expect(newestSlugOf('editor-draft')).toBe('editor-draft');
  });
});

describe('slugAliases', () => {
  it('answers with the slug as asked, then every other spelling, newest first', () => {
    expect(slugAliases('mojave-sun')).toEqual(['mojave-sun', 'pp-001', 'pp-001-vivid-nostalgia-film']);
    expect(slugAliases('pp-001-vivid-nostalgia-film')).toEqual(['pp-001-vivid-nostalgia-film', 'pp-001', 'mojave-sun']);
    expect(slugAliases('pp-001')).toEqual(['pp-001', 'pp-001-vivid-nostalgia-film', 'mojave-sun']);
  });

  it('covers all three spellings of every seed recipe, from each of them', () => {
    for (const s of spellings) {
      for (const slug of [s.first, s.oct24, s.code]) {
        const aliases = slugAliases(slug);
        expect(aliases[0], s.id).toBe(slug);
        expect([...aliases].sort(), `${s.id} ${slug}`).toEqual([s.first, s.oct24, s.code].sort());
      }
    }
  });

  it('is only the slug itself when no batch knows it', () => {
    expect(slugAliases('editor-draft')).toEqual(['editor-draft']);
  });
});

describe('isPermanentMove', () => {
  it('is permanent only from an older spelling of one recipe to a newer one', () => {
    for (const s of spellings) {
      const history = [s.first, s.oct24, s.code];
      history.forEach((from, i) =>
        history.forEach((to, j) => expect(isPermanentMove(from, to), `${from} -> ${to}`).toBe(i < j)),
      );
    }
    /* The unmigrated database, sent back temporarily: a cached 308 this way
       would loop once the migration sends the older slug forward. */
    expect(isPermanentMove('pp-001', 'pp-001-vivid-nostalgia-film')).toBe(false);
    expect(isPermanentMove('mojave-sun', 'pp-002')).toBe(false);
    expect(isPermanentMove('editor-draft', 'pp-001')).toBe(false);
  });
});

describe('search by an earlier slug', () => {
  const pp001 = seed.find((r) => r.id === 'PP-001')!;
  /* The same row in each state of the content plane. */
  const states = [
    pp001,
    { ...pp001, slug: 'pp-001-vivid-nostalgia-film' },
    { ...pp001, id: 'SCL-PP-001', slug: 'mojave-sun' },
  ];

  it('finds the recipe by the name it was first published under and by its code, in every state', () => {
    for (const r of states) {
      expect(matchesQuery(r, 'mojave sun'), r.slug).toBe(true);
      expect(matchesQuery(r, 'vivid nostalgia'), r.slug).toBe(true);
      expect(matchesQuery(r, 'pp 001'), r.slug).toBe(true);
    }
  });

  it('makes every spelling an exact hit and the earlier ones tags', () => {
    for (const r of states) {
      const doc = recipeDoc({ ...r, wbLabel: '', description: '' }, 'en');
      expect(doc.exact, r.slug).toEqual(expect.arrayContaining(['mojavesun', 'pp001vividnostalgiafilm', 'pp001']));
      expect(doc.tags, r.slug).toEqual(expect.arrayContaining(['mojave sun', 'pp 001 vivid nostalgia film']));
    }
  });
});

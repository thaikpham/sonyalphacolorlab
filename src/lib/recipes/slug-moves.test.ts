import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Recipe } from '@/lib/camera/schema';
import {
  SLUG_MOVES,
  formerSlugsFor,
  recipeIdOfSlug,
  slugAtState,
  slugHistories,
  type SlugMoveBatch,
} from './slug-moves';

/**
 * The former-slug map is frozen with the migrations that carry it. These pin
 * the two ways a re-emit used to move it — a newcomer whose source spells a
 * slug of its own, and a moved recipe renamed again — and the histories every
 * alias lookup and `library:sync` read off the batches.
 */

const seed = JSON.parse(readFileSync('data/recipes.seed.json', 'utf8')) as Recipe[];
const [OCT24, OCT28] = SLUG_MOVES;
const [someFormer, someMiddle] = Object.entries(OCT24.moves)[0];
const someCode = OCT28.moves[someMiddle];

/** Every earlier spelling of each recipe to its newest, from the batches by hand. */
const composed = Object.fromEntries([
  ...Object.entries(OCT24.moves).map(([first, middle]) => [first, OCT28.moves[middle]] as const),
  ...Object.entries(OCT28.moves),
]);

describe('the frozen batches', () => {
  it('are the 2026-10-24 move to code and name, then the 2026-10-28 move to the code alone', () => {
    expect(SLUG_MOVES.map((b) => [b.date, b.content, b.control])).toEqual([
      ['2026-10-24', '20261024000000_recipe_code_ids.sql', '0020_recipe_slugs_to_codes.sql'],
      ['2026-10-28', '20261028000000_recipe_code_slugs.sql', '0021_recipe_slugs_to_code_only.sql'],
    ]);
  });

  it('moves every 2026-10-24 slug, and only those, to its code', () => {
    expect(Object.keys(OCT28.moves).sort()).toEqual(Object.values(OCT24.moves).sort());
    for (const [middle, code] of Object.entries(OCT28.moves)) {
      expect(code, middle).toBe(recipeIdOfSlug(middle)!.toLowerCase());
    }
  });
});

describe('formerSlugsFor', () => {
  it('maps the seed as the batches compose, every earlier spelling to the code, with nothing to report', () => {
    const { formerSlugs, problems } = formerSlugsFor(seed);
    expect(problems).toEqual([]);
    expect(formerSlugs).toEqual(composed);
    expect(formerSlugs[someFormer]).toBe(someCode);
    expect(formerSlugs[someMiddle]).toBe(someCode);
  });

  it('gives a recipe born after the moves no former slug, whatever its source called it', () => {
    /* A Sony Asia row imported next month: the importer slugs it
       `fl-sandeeshwara-perera-4`, and the seed emits its code. Neither
       migration knows it, and no database ever held the importer's slug. */
    const newcomer = { id: 'CL-099', slug: 'cl-099' };
    const { formerSlugs, problems } = formerSlugsFor([...seed, newcomer]);
    expect(problems).toEqual([]);
    expect(formerSlugs).toEqual(composed);
    expect(Object.values(formerSlugs)).not.toContain(newcomer.slug);
  });

  it('refuses to rename a recipe whose slug already moved', () => {
    const id = recipeIdOfSlug(someCode)!;
    for (const slug of [`${id.toLowerCase()}-mono-deep-noir`, someMiddle]) {
      const renamed = seed.map((r) => (r.id === id ? { ...r, slug } : r));
      const { problems } = formerSlugsFor(renamed);
      expect(problems, slug).toHaveLength(1);
      expect(problems[0]).toContain(id);
      expect(problems[0]).toContain(someCode);
      expect(problems[0]).toContain('2026-10-28');
      expect(problems[0]).toMatch(/new pair of migrations/);
    }
  });

  it('keeps a withdrawn recipe’s moves: links and community rows still name it', () => {
    const id = recipeIdOfSlug(someCode)!;
    const { formerSlugs } = formerSlugsFor(seed.filter((r) => r.id !== id));
    expect(formerSlugs[someFormer]).toBe(someCode);
    expect(formerSlugs[someMiddle]).toBe(someCode);
  });

  it('reads an id in either shape', () => {
    const id = recipeIdOfSlug(someCode)!;
    const { problems } = formerSlugsFor([{ id: `SCL-${id}`, slug: 'scl-renamed' }]);
    expect(problems).toHaveLength(1);
  });

  it('takes a later batch as the recipe’s newest slug', () => {
    const id = recipeIdOfSlug(someCode)!;
    const later = `${id.toLowerCase()}-again`;
    const batches: SlugMoveBatch[] = [
      ...SLUG_MOVES,
      { date: '2027-01-01', content: 'x.sql', control: 'y.sql', moves: { [someCode]: later } },
    ];
    const { formerSlugs, problems } = formerSlugsFor([{ id, slug: later }], batches);
    expect(problems).toEqual([]);
    expect(formerSlugs[someFormer]).toBe(later);
    expect(formerSlugs[someMiddle]).toBe(later);
    expect(formerSlugs[someCode]).toBe(later);
  });

  it('reports a batch that moves a slug which had already moved on', () => {
    const batches: SlugMoveBatch[] = [
      ...SLUG_MOVES,
      { date: '2027-01-01', content: 'x.sql', control: 'y.sql', moves: { [someMiddle]: 'pp-001-again' } },
    ];
    const { problems } = formerSlugsFor(seed, batches);
    expect(problems.join('\n')).toMatch(/moved again after it had already moved/);
  });
});

describe('slugHistories and slugAtState', () => {
  it('gives each seed recipe its three spellings with the state each is held from', () => {
    const histories = slugHistories();
    for (const [first, middle] of Object.entries(OCT24.moves)) {
      const code = OCT28.moves[middle];
      const expected = [
        { slug: first, since: 0 },
        { slug: middle, since: 1 },
        { slug: code, since: 2 },
      ];
      for (const s of [first, middle, code]) expect(histories.get(s), s).toEqual(expected);
      for (const s of [first, middle, code]) {
        expect([0, 1, 2].map((n) => slugAtState(s, n)), s).toEqual([first, middle, code]);
      }
    }
  });

  it('leaves a slug no batch knows as itself in every state', () => {
    expect([0, 1, 2].map((n) => slugAtState('editor-draft', n))).toEqual(['editor-draft', 'editor-draft', 'editor-draft']);
  });

  it('starts a history at the batch that first moves it: its first spelling is held from state 0', () => {
    const batches: SlugMoveBatch[] = [
      { date: 'a', content: 'a.sql', control: 'a.sql', moves: { 'one-a': 'pp-001-a' } },
      { date: 'b', content: 'b.sql', control: 'b.sql', moves: { 'pp-001-a': 'pp-001', 'late-born': 'pp-002' } },
    ];
    const histories = slugHistories(batches);
    expect([0, 1, 2].map((n) => slugAtState('pp-002', n, histories))).toEqual(['late-born', 'late-born', 'pp-002']);
    expect([0, 1, 2].map((n) => slugAtState('pp-001', n, histories))).toEqual(['one-a', 'pp-001-a', 'pp-001']);
  });
});

describe('recipeIdOfSlug', () => {
  it('reads the code off a code-shape slug, with or without words, and nothing else', () => {
    expect(recipeIdOfSlug('pp-048-soft-clean-portrait')).toBe('PP-048');
    expect(recipeIdOfSlug('cl-013-airy-warm-pastel')).toBe('CL-013');
    expect(recipeIdOfSlug('pp-048')).toBe('PP-048');
    expect(recipeIdOfSlug('pp-0480')).toBeNull();
    expect(recipeIdOfSlug('mojave-sun')).toBeNull();
  });

  it('reads a code off every frozen move', () => {
    for (const batch of SLUG_MOVES) {
      for (const current of Object.values(batch.moves)) expect(recipeIdOfSlug(current), current).not.toBeNull();
    }
  });
});

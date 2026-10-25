import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Recipe } from '@/lib/camera/schema';
import { SLUG_MOVES, formerSlugsFor, recipeIdOfSlug, type SlugMoveBatch } from './slug-moves';

/**
 * The former-slug map is frozen with the migrations that carry it. These pin
 * the two ways a re-emit used to move it: a newcomer whose source spells a
 * slug of its own, and a moved recipe renamed again.
 */

const seed = JSON.parse(readFileSync('data/recipes.seed.json', 'utf8')) as Recipe[];
const [OCT24] = SLUG_MOVES;
const [someFormer, someCurrent] = Object.entries(OCT24.moves)[0];

describe('formerSlugsFor', () => {
  it('maps the seed exactly as the frozen batch, with nothing to report', () => {
    const { formerSlugs, problems } = formerSlugsFor(seed);
    expect(problems).toEqual([]);
    expect(formerSlugs).toEqual(OCT24.moves);
  });

  it('gives a recipe born after the move no former slug, whatever its source called it', () => {
    /* A Sony Asia row imported next month: the importer slugs it
       `fl-sandeeshwara-perera-4`, and the seed emits `slugFor(name)`. Neither
       migration knows it, and no database ever held the importer's slug. */
    const newcomer = { id: 'CL-099', slug: 'cl-099-film-warm-soft' };
    const { formerSlugs, problems } = formerSlugsFor([...seed, newcomer]);
    expect(problems).toEqual([]);
    expect(formerSlugs).toEqual(OCT24.moves);
    expect(Object.values(formerSlugs)).not.toContain(newcomer.slug);
  });

  it('refuses to rename a recipe whose slug already moved', () => {
    const id = recipeIdOfSlug(someCurrent)!;
    const renamed = seed.map((r) => (r.id === id ? { ...r, slug: `${id.toLowerCase()}-mono-deep-noir` } : r));
    const { problems } = formerSlugsFor(renamed);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain(id);
    expect(problems[0]).toContain(someCurrent);
    expect(problems[0]).toMatch(/new pair of migrations/);
  });

  it('keeps a withdrawn recipe’s move: links and community rows still name it', () => {
    const id = recipeIdOfSlug(someCurrent)!;
    const { formerSlugs } = formerSlugsFor(seed.filter((r) => r.id !== id));
    expect(formerSlugs[someFormer]).toBe(someCurrent);
  });

  it('reads an id in either shape', () => {
    const id = recipeIdOfSlug(someCurrent)!;
    const { problems } = formerSlugsFor([{ id: `SCL-${id}`, slug: 'scl-renamed' }]);
    expect(problems).toHaveLength(1);
  });

  it('takes a later batch as the recipe’s latest slug', () => {
    const id = recipeIdOfSlug(someCurrent)!;
    const later = `${id.toLowerCase()}-soft-clean-portrait-two`;
    const batches: SlugMoveBatch[] = [
      ...SLUG_MOVES,
      { date: '2027-01-01', content: 'x.sql', control: 'y.sql', moves: { [someCurrent]: later } },
    ];
    const { formerSlugs, problems } = formerSlugsFor([{ id, slug: later }], batches);
    expect(problems).toEqual([]);
    expect(formerSlugs[someCurrent]).toBe(later);
  });
});

describe('recipeIdOfSlug', () => {
  it('reads the code off a code-shape slug, and nothing else', () => {
    expect(recipeIdOfSlug('pp-048-soft-clean-portrait')).toBe('PP-048');
    expect(recipeIdOfSlug('cl-013-airy-warm-pastel')).toBe('CL-013');
    expect(recipeIdOfSlug('mojave-sun')).toBeNull();
  });

  it('reads a code off every frozen move', () => {
    for (const current of Object.values(OCT24.moves)) expect(recipeIdOfSlug(current), current).not.toBeNull();
  });
});

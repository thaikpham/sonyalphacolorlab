import { describe, expect, it } from 'vitest';

import { listRecipes } from '@/lib/recipes/source';
import { recipeChips } from './chips';

/**
 * A React key collision is a silent content bug, and this one shipped.
 *
 * The card's three chips were keyed by their VALUE. `S-Cinetone` is a legal
 * value of both `PP_GAMMA` and `PP_COLOR_MODE`, and 9 of the catalogue's 46
 * Picture Profile recipes set both dials to it — so those nine cards rendered
 * two chips instead of three and dropped the Color Mode. React logs a warning
 * in development and says nothing at all in production; nothing threw, nothing
 * failed a build, and the gallery simply told the reader less than it knew.
 *
 * Keys are the chip's SLOT now, which cannot collide by construction. This
 * walks the real catalogue to prove it, because the failure was a property of
 * the data rather than of the code — a fixture with three distinct values
 * passes either implementation.
 */
describe('recipe card chips', () => {
  it('gives every chip a unique key, for every recipe in the catalogue', async () => {
    const recipes = await listRecipes('en');
    expect(recipes.length).toBeGreaterThan(0);

    const collisions = recipes
      .map((recipe) => {
        const slots = recipeChips(recipe).map((c) => c.slot);
        return { id: recipe.id, slots, unique: new Set(slots).size === slots.length };
      })
      .filter((r) => !r.unique);

    expect(collisions, 'these recipes would drop a chip to a duplicate React key').toEqual([]);
  });

  it('always renders three chips — the count is what the collision ate', async () => {
    const recipes = await listRecipes('en');
    for (const recipe of recipes) {
      expect(recipeChips(recipe), `${recipe.id} lost a chip`).toHaveLength(3);
    }
  });

  /**
   * The fixture that caused it, pinned by name. If the catalogue ever stops
   * containing a recipe whose gamma and colour mode read the same, the test
   * above keeps passing for a reason that has nothing to do with the fix —
   * and the next person to key by value gets a green suite.
   */
  it('still contains the case that broke it — two dials reading the same', async () => {
    const recipes = await listRecipes('en');
    const sameOnBothDials = recipes.filter((r) => {
      const chips = recipeChips(r);
      const values = chips.map((c) => c.value);
      return r.format === 'pp' && new Set(values).size < values.length;
    });

    expect(
      sameOnBothDials.length,
      'no recipe now sets two dials to the same value; this guard has gone vacuous',
    ).toBeGreaterThan(0);
  });
});

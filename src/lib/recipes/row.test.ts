import { describe, expect, it } from 'vitest';
import recipesSeed from '../../../data/recipes.seed.json';
import { recipeSchema, type Recipe } from '../camera/schema';
import { fromRow, toRow, type RecipeRow } from './row';

/**
 * `fromRow` is the only parser on every online recipe read, and it throws —
 * which takes the catalogue down — if it rebuilds a shape wrongly. It had no
 * test: the migration suite only inserts `toRow` output, and everything else
 * reads the seed offline.
 *
 * So every seed recipe goes through the column flattening and back, with the
 * shift amounts arriving the way `numeric(3,2)` can arrive over PostgREST: as
 * strings.
 */

const seed = recipesSeed as unknown as (Recipe & { legacyId: string | null })[];

/** A row as the wire delivers it: numerics as strings. */
function overTheWire(row: RecipeRow): RecipeRow {
  const asString = (n: number | null) => (n === null ? null : (String(n) as unknown as number));
  return {
    ...row,
    wb_shift_ab_amount: asString(row.wb_shift_ab_amount),
    wb_shift_gm_amount: asString(row.wb_shift_gm_amount),
  };
}

describe('fromRow', () => {
  it('rebuilds every seed recipe exactly', () => {
    for (const r of seed) {
      expect(fromRow(overTheWire(toRow(r, r.legacyId))), r.id).toEqual(recipeSchema.parse(r));
    }
  });

  it('covers all three white-balance modes', () => {
    const modes = new Set(seed.map((r) => r.whiteBalance.mode));
    expect([...modes].sort()).toEqual(['auto', 'kelvin', 'preset']);
  });

  it('rebuilds a shift on one axis only, without inventing the other', () => {
    const base = seed.find((r) => r.whiteBalance.mode === 'kelvin')!;
    for (const shift of [{ gm: { axis: 'M', amount: 1.5 } }, { ab: { axis: 'A', amount: 0.25 } }]) {
      const recipe = recipeSchema.parse({
        ...base,
        whiteBalance: { mode: 'kelvin', kelvin: 5600, shift },
      });
      expect(fromRow(overTheWire(toRow(recipe)))).toEqual(recipe);
    }
  });

  it('names the recipe when a row fails validation', () => {
    const row = { ...toRow(seed[0]), settings: { nonsense: true } };
    expect(() => fromRow(row)).toThrow(seed[0].id);
  });
});

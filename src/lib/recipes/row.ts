/**
 * Maps a validated `Recipe` to and from its `recipes` table row.
 *
 * White balance is flattened into real columns so the grid can filter on it;
 * the format-specific settings stay in jsonb. `look` is denormalised out of the
 * Creative Look settings to drive the homepage filter.
 */

import { recipeSchema, type Recipe } from '../camera/schema';

export type RecipeRow = {
  id: string;
  legacy_id: string | null;
  slug: string;
  name: string;
  format: 'pp' | 'cl';
  wb_mode: 'kelvin' | 'auto' | 'preset';
  wb_kelvin: number | null;
  wb_auto: string | null;
  wb_preset: string | null;
  wb_shift_ab_axis: 'A' | 'B' | null;
  wb_shift_ab_amount: number | null;
  wb_shift_gm_axis: 'G' | 'M' | null;
  wb_shift_gm_amount: number | null;
  look: string | null;
  settings: unknown;
  tags: string[];
  published: boolean;
};

/**
 * Rebuilds a Recipe from its row, re-validating on the way out.
 *
 * The database is not trusted to be well-formed just because it has CHECK
 * constraints: `settings` is jsonb, so its shape is only ever enforced by Zod.
 * A row that fails here is a data bug, not a rendering bug, and should say so.
 */
export function fromRow(row: RecipeRow): Recipe {
  const shift =
    row.wb_shift_ab_axis || row.wb_shift_gm_axis
      ? {
          ...(row.wb_shift_ab_axis
            ? { ab: { axis: row.wb_shift_ab_axis, amount: Number(row.wb_shift_ab_amount) } }
            : {}),
          ...(row.wb_shift_gm_axis
            ? { gm: { axis: row.wb_shift_gm_axis, amount: Number(row.wb_shift_gm_amount) } }
            : {}),
        }
      : undefined;

  const tail = shift ? { shift } : {};
  const whiteBalance =
    row.wb_mode === 'kelvin'
      ? { mode: 'kelvin', kelvin: Number(row.wb_kelvin), ...tail }
      : row.wb_mode === 'preset'
        ? { mode: 'preset', preset: row.wb_preset, ...tail }
        : { mode: 'auto', auto: row.wb_auto, ...tail };

  const parsed = recipeSchema.safeParse({
    id: row.id,
    slug: row.slug,
    name: row.name,
    format: row.format,
    whiteBalance,
    tags: row.tags ?? [],
    published: row.published,
    settings: row.settings,
  });

  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('; ');
    throw new Error(`recipe ${row.id} failed validation on read: ${detail}`);
  }
  return parsed.data;
}

export function toRow(recipe: Recipe, legacyId: string | null = null): RecipeRow {
  const wb = recipe.whiteBalance;
  return {
    id: recipe.id,
    legacy_id: legacyId,
    slug: recipe.slug,
    name: recipe.name,
    format: recipe.format,
    wb_mode: wb.mode,
    wb_kelvin: wb.mode === 'kelvin' ? wb.kelvin : null,
    wb_auto: wb.mode === 'auto' ? wb.auto : null,
    wb_preset: wb.mode === 'preset' ? wb.preset : null,
    wb_shift_ab_axis: wb.shift?.ab?.axis ?? null,
    wb_shift_ab_amount: wb.shift?.ab?.amount ?? null,
    wb_shift_gm_axis: wb.shift?.gm?.axis ?? null,
    wb_shift_gm_amount: wb.shift?.gm?.amount ?? null,
    look: recipe.format === 'cl' ? recipe.settings.look : null,
    settings: recipe.settings,
    tags: recipe.tags,
    published: recipe.published,
  };
}

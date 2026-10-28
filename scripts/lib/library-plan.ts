/**
 * What `library:sync` would do to the content project, worked out without it.
 *
 * Pure: the seed, the rows the project holds, the withdrawn ids and the ids of
 * ColorLab's own originals go in; a plan comes out. The script prints it, and
 * writes it only with `--apply`. Kept apart from the script so every rule below
 * is a unit test rather than a production write.
 *
 * Before any rule, `storedShape` reads which id shape the project holds and
 * `seedInStoredShape` puts the seed in it: until the content migration runs
 * that is `SCL-PP-048` at `hue-silk`, which the migration later renames with
 * every other row. A project holding both shapes is not planned at all.
 *
 * The rules, in the order they win:
 *
 * - A **withdrawn** id that is still published is unpublished, and nothing else
 *   happens to it. Never a delete: comments, proposals and contributed
 *   photographs on the control plane point at its slug.
 * - A seed recipe the project **lacks** is inserted unpublished, whatever the
 *   seed says — publishing is an editor's act in /admin/colorlab.
 * - A slug the project already gives to a **different** id stops the run: the
 *   unique index would refuse the insert anyway, and a silent skip is how a
 *   recipe goes missing. So does the reverse — an id the project holds under a
 *   **different slug**: that row is not the seed's recipe but one an editor
 *   created and `nextRecipeId` happened to number like an original, and
 *   refreshing or renaming it would put the original's colour over theirs.
 * - An **original** the project holds unpublished follows the seed whole
 *   (settings, white balance, tags, name, translations) — until the owner
 *   publishes it, the seed is its only source.
 * - Every other recipe the project holds keeps its settings; only a **name**
 *   that differs from the seed is updated. A published recipe's colour science
 *   is never changed by a script.
 */

import type { Recipe } from '../../src/lib/camera/schema';
import { recipeIdKey } from '../../src/lib/recipes/recipe-id';
import { toRow, type RecipeRow } from '../../src/lib/recipes/row';
import { formerSlugOf } from '../../src/lib/recipes/slug-aliases';

export type PlanSeedRecipe = {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
};

export type PlanExistingRow = {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly published: boolean;
};

export type LibraryPlan = {
  /** Withdrawn ids still published. */
  readonly unpublish: readonly string[];
  /** Name changes on rows that otherwise keep everything. */
  readonly rename: readonly { readonly id: string; readonly from: string; readonly to: string }[];
  /** Unpublished originals that take the seed's row and translations whole. */
  readonly refresh: readonly string[];
  /** Seed recipes the project does not have, to insert unpublished. */
  readonly insert: readonly string[];
  /** Seed slugs the project gives to another id. Non-empty means stop. */
  readonly conflicts: readonly { readonly id: string; readonly slug: string; readonly heldBy: string }[];
};

const LEGACY_ID = /^SCL-/;

/**
 * The id shape the content project holds: `legacy` (`SCL-PP-001` at
 * `mojave-sun`) until the owner applies the code-id migration by hand, `code`
 * (`PP-001` at `pp-001-vivid-nostalgia-film`), the seed's own, after it.
 */
export type StoredShape = 'legacy' | 'code';

const sample = (ids: readonly string[]) => `${ids.slice(0, 3).join(', ')}${ids.length > 3 ? ', …' : ''}`;

/**
 * Which shape `library:sync` writes in, read off the rows the project holds,
 * or why it must not write at all.
 *
 * Every id `SCL-` shaped is `legacy`: the sync writes that shape and the
 * content migration renames those rows with the rest, so the sync need not
 * wait for it. Every id code-shaped, or no rows, is `code`. Both at once is a
 * project nobody should write into. So is a code-shaped project against a seed
 * still in the `SCL-` shape: every recipe would read as missing, and the plan
 * would insert the library a second time beside itself.
 */
export function storedShape(
  seedIds: readonly string[],
  existingIds: readonly string[],
): { readonly shape: StoredShape } | { readonly refusal: string } {
  const legacy = existingIds.filter((id) => LEGACY_ID.test(id));
  const code = existingIds.filter((id) => !LEGACY_ID.test(id));
  if (legacy.length > 0 && code.length > 0) {
    return {
      refusal:
        `The content project holds ids in both shapes: ${legacy.length} SCL- (${sample(legacy)}) and ` +
        `${code.length} code-shaped (${sample(code)}). Bring it to one shape before library:sync ` +
        'writes into it. Nothing was planned or written.',
    };
  }
  if (code.length > 0 && seedIds.some((id) => LEGACY_ID.test(id))) {
    return {
      refusal:
        `The seed's ids are SCL- shaped but the content project holds ${code.length} code-shaped id(s) ` +
        `(${sample(code)}). Re-run npm run seed:emit from the current tree, then library:sync. ` +
        'Nothing was planned or written.',
    };
  }
  return { shape: legacy.length > 0 ? 'legacy' : 'code' };
}

/** A seed id as the project stores it: `PP-048` is `SCL-PP-048` in the legacy shape. */
export const storedId = (id: string, shape: StoredShape): string =>
  shape === 'legacy' ? `SCL-${recipeIdKey(id)}` : id;

/**
 * A seed slug as the project stores it. In the legacy shape that is the slug
 * the recipe moved from (`pp-048-soft-clean-portrait` → `hue-silk`), the one
 * the content migration renames; a recipe born after the move has none and is
 * stored under its own, which the migration leaves as it is.
 */
export const storedSlug = (slug: string, shape: StoredShape): string =>
  shape === 'legacy' ? (formerSlugOf(slug) ?? slug) : slug;

type Keyed = { readonly id: string; readonly slug: string };

export type SyncSeed<R extends Keyed> = {
  readonly recipes: readonly { readonly recipe: R; readonly legacyId: string | null }[];
  readonly translations: readonly { readonly recipeId: string; readonly locale: string; readonly description: string }[];
  /** Withdrawn ids, `RETIRED_RECIPE_IDS`. */
  readonly retired: readonly string[];
  /** Ids of ColorLab's own originals, `ORIGINAL_PP` and `ORIGINAL_CL`. */
  readonly originals: readonly string[];
};

/**
 * The seed in the project's shape, before anything is planned from it.
 *
 * Only ids and slugs change. The name stays the `PP-NNN` / `CL-NNN` one: that
 * is what production should show on either side of the migration. Translations
 * and withdrawn ids follow the id, so the plan, its conflict checks and every
 * write guarded by what it matched all compare stored values. In the code shape
 * this is the identity.
 */
export function seedInStoredShape<R extends Keyed>(seed: SyncSeed<R>, shape: StoredShape): SyncSeed<R> {
  if (shape === 'code') return seed;
  return {
    recipes: seed.recipes.map((s) => ({
      ...s,
      recipe: { ...s.recipe, id: storedId(s.recipe.id, shape), slug: storedSlug(s.recipe.slug, shape) },
    })),
    translations: seed.translations.map((t) => ({ ...t, recipeId: storedId(t.recipeId, shape) })),
    retired: seed.retired.map((id) => storedId(id, shape)),
    originals: seed.originals.map((id) => storedId(id, shape)),
  };
}

export function planLibrarySync(
  seed: readonly PlanSeedRecipe[],
  existing: readonly PlanExistingRow[],
  retired: readonly string[],
  originals: ReadonlySet<string>,
): LibraryPlan {
  const byId = new Map(existing.map((r) => [r.id, r]));
  const bySlug = new Map(existing.map((r) => [r.slug, r]));
  const withdrawn = new Set(retired);

  const unpublish = retired.filter((id) => byId.get(id)?.published === true);

  const rename: { id: string; from: string; to: string }[] = [];
  const refresh: string[] = [];
  const insert: string[] = [];
  const conflicts: { id: string; slug: string; heldBy: string }[] = [];

  for (const r of seed) {
    if (withdrawn.has(r.id)) continue;
    const holder = bySlug.get(r.slug);
    if (holder && holder.id !== r.id) {
      conflicts.push({ id: r.id, slug: r.slug, heldBy: holder.id });
      continue;
    }
    const row = byId.get(r.id);
    if (!row) {
      insert.push(r.id);
      continue;
    }
    if (row.slug !== r.slug) {
      conflicts.push({ id: r.id, slug: r.slug, heldBy: `${row.id} (as ${row.slug})` });
      continue;
    }
    if (originals.has(r.id) && !row.published) {
      refresh.push(r.id);
      continue;
    }
    if (row.name !== r.name) rename.push({ id: r.id, from: row.name, to: r.name });
  }

  return { unpublish, rename, refresh, insert, conflicts };
}

/**
 * What the script plans from: the project's shape, the seed in it, and the plan
 * over that — or the refusal. Every id and slug in `stored` and `plan` is the
 * one the project holds, which is what each write is guarded on.
 */
export function planForProject<R extends Keyed & { readonly name: string }>(
  seed: SyncSeed<R>,
  existing: readonly PlanExistingRow[],
): { readonly refusal: string } | { readonly shape: StoredShape; readonly stored: SyncSeed<R>; readonly plan: LibraryPlan } {
  const read = storedShape(
    seed.recipes.map(({ recipe }) => recipe.id),
    existing.map((r) => r.id),
  );
  if ('refusal' in read) return read;
  const stored = seedInStoredShape(seed, read.shape);
  const plan = planLibrarySync(
    stored.recipes.map(({ recipe }) => ({ id: recipe.id, slug: recipe.slug, name: recipe.name })),
    existing,
    stored.retired,
    new Set(stored.originals),
  );
  return { shape: read.shape, stored, plan };
}

/** The rows an insert writes: each stored recipe whole, unpublished whatever the seed says. */
export function insertRows(plan: LibraryPlan, stored: SyncSeed<Recipe>): RecipeRow[] {
  const byId = new Map(stored.recipes.map((s) => [s.recipe.id, s]));
  return plan.insert.map((id) => {
    const { recipe, legacyId } = byId.get(id)!;
    return toRow({ ...recipe, published: false } as Recipe, legacyId);
  });
}

/** What a refresh sets: the stored recipe's row without its keys, kept unpublished. */
export function refreshFields(recipe: Recipe): Omit<RecipeRow, 'id' | 'slug' | 'legacy_id'> {
  const { id: _id, slug: _slug, legacy_id: _legacy, ...rest } = toRow({ ...recipe, published: false } as Recipe, null);
  return { ...rest, published: false };
}

/** Translation rows for these stored ids, keyed by the stored id. */
export function translationRows(
  stored: SyncSeed<Keyed>,
  ids: readonly string[],
): { recipe_id: string; locale: string; description: string }[] {
  return stored.translations
    .filter((t) => ids.includes(t.recipeId))
    .map((t) => ({ recipe_id: t.recipeId, locale: t.locale, description: t.description }));
}

import 'server-only';
import { contentAdmin } from '@/lib/supabase/server';
import { recipeSchema, type Recipe } from '../camera/schema';
import { fromRow, toRow, type RecipeRow } from './row';
import type { RecipeRecord } from './admin-types';
import {
  devGetRecipe,
  devListRecipes,
  devRecipeIds,
  devRecipeSlugs,
  devUpsertRecipe,
  isRecipeDevStore,
} from './dev-store';

/**
 * The admin's view of the recipe store: every row, drafts included.
 *
 * Separate from `source.ts` and deliberately uncached, the same split
 * `lib/lab/admin-store.ts` keeps from `lib/lab/data.ts`. `source.ts` is the
 * reading path — wrapped in `catalogueCache` and hard-filtered to
 * `published = true`, which is exactly right for readers and useless for an
 * editor: they cannot list a draft, cannot open one, and would see their own
 * save through a 60-second cache. Mixing the two into one module with an
 * `includeDrafts` flag is how a draft reaches a reader's feed; they are kept
 * apart so that flag cannot exist.
 *
 * Every read branches on `isRecipeDevStore()` first, so the same editor screen
 * works against the content project and against a JSON file on a laptop. The
 * branch is here rather than in the routes so there is one of it.
 */

/* Every column `fromRow` needs, named rather than `*`: a `select('*')` here
   would start shipping any column added later to a screen that does not know
   about it, and silently widen what a write round-trips. */
const ADMIN_COLUMNS =
  'id, legacy_id, slug, name, format, wb_mode, wb_kelvin, wb_auto, wb_preset, ' +
  'wb_shift_ab_axis, wb_shift_ab_amount, wb_shift_gm_axis, wb_shift_gm_amount, ' +
  'look, settings, tags, published, updated_at';

type Row = RecipeRow & { updated_at?: string };

/**
 * A row becomes a record, or it is dropped.
 *
 * `fromRow` throws on a row that fails the schema, and on this screen that is
 * the wrong response: one malformed row would make the whole list unreachable,
 * including the rows an editor needs in order to fix it. A reader's path still
 * throws — `source.ts` is unchanged — because there a bad row is a bug that
 * should be loud rather than a row to be repaired.
 */
function toRecord(row: Row): RecipeRecord | null {
  try {
    return {
      recipe: fromRow(row),
      legacyId: row.legacy_id ?? null,
      updatedAt: typeof row.updated_at === 'string' ? row.updated_at : '',
    };
  } catch (err) {
    console.error('[admin/recipes] skipping unreadable row:', row.id, err);
    return null;
  }
}

export async function listRecipeRecords(): Promise<RecipeRecord[]> {
  if (isRecipeDevStore()) return devListRecipes();

  const { data, error } = await contentAdmin()
    .from('recipes')
    .select(ADMIN_COLUMNS)
    .order('id', { ascending: true });

  if (error || !Array.isArray(data)) throw new Error(error?.message ?? 'listFailed');
  return (data as unknown as Row[]).map(toRecord).filter((r): r is RecipeRecord => r !== null);
}

export async function getRecipeRecord(id: string): Promise<RecipeRecord | null> {
  if (isRecipeDevStore()) return devGetRecipe(id);

  const { data, error } = await contentAdmin()
    .from('recipes')
    .select(ADMIN_COLUMNS)
    .eq('id', id)
    .maybeSingle();

  if (error || !data) return null;
  return toRecord(data as unknown as Row);
}

// ---------------------------------------------------------------------------
// Allocation
// ---------------------------------------------------------------------------

/**
 * The next free `SCL-PP-###` / `SCL-CL-###`.
 *
 * Ids are sequential per format and three digits wide, which caps each format
 * at 999 — a real ceiling rather than a theoretical one, so it is reported
 * instead of wrapping to `SCL-PP-1000` and failing the table's CHECK
 * constraint with a message about a regex.
 *
 * The gap after a hard delete is never reused. Nothing hard-deletes a recipe
 * today (see `unpublishRecipe`), but an id that once addressed a published
 * recipe is a URL somebody may still hold, and handing it to a different
 * recipe would answer that URL with the wrong colour science.
 */
export async function nextRecipeId(format: 'pp' | 'cl'): Promise<string> {
  const prefix = `SCL-${format.toUpperCase()}-`;
  const ids = isRecipeDevStore() ? devRecipeIds() : await allIds();

  let highest = 0;
  for (const id of ids) {
    if (!id.startsWith(prefix)) continue;
    const n = Number(id.slice(prefix.length));
    if (Number.isInteger(n) && n > highest) highest = n;
  }

  const next = highest + 1;
  if (next > 999) throw new Error('idSpaceExhausted');
  return `${prefix}${String(next).padStart(3, '0')}`;
}

async function allIds(): Promise<string[]> {
  const { data, error } = await contentAdmin().from('recipes').select('id');
  if (error || !Array.isArray(data)) throw new Error(error?.message ?? 'listFailed');
  return (data as { id: string }[]).map((r) => r.id);
}

/** Kebab-case, diacritics folded, so a Vietnamese name still yields a URL. */
export function slugifyRecipe(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
}

/**
 * A slug nothing else owns.
 *
 * `slug` is unique in SQL, so a collision is an error either way; resolving it
 * here means an editor naming a second recipe "Golden Hour" gets
 * `golden-hour-2` instead of a save that fails and asks them to invent a
 * different name. Bounded, then a timestamp: a loop with no ceiling against a
 * database is a way to hang a request.
 */
export async function uniqueRecipeSlug(name: string, ownId?: string): Promise<string> {
  const base = slugifyRecipe(name) || `cong-thuc-${Date.now().toString(36)}`;

  /* One loop, two backends, so the suffix rule cannot drift between local
     development and production. */
  const taken = async (slug: string): Promise<boolean> => {
    if (isRecipeDevStore()) {
      const owner = devListRecipes().find((r) => r.recipe.slug === slug);
      return Boolean(owner) && owner?.recipe.id !== ownId;
    }
    const { data } = await contentAdmin()
      .from('recipes')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    return Boolean(data) && (data as { id: string } | null)?.id !== ownId;
  };

  for (let n = 1; n <= 20; n += 1) {
    const candidate = n === 1 ? base : `${base}-${n}`;
    if (!(await taken(candidate))) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

export async function recipeSlugs(): Promise<string[]> {
  if (isRecipeDevStore()) return devRecipeSlugs();
  const { data, error } = await contentAdmin().from('recipes').select('slug');
  if (error || !Array.isArray(data)) throw new Error(error?.message ?? 'listFailed');
  return (data as { slug: string }[]).map((r) => r.slug);
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/**
 * Validates an untrusted body into a Recipe.
 *
 * An admin is trusted to publish, not trusted to have sent well-formed JSON —
 * and `settings` is jsonb, so the table checks only that it is an object. Zod
 * is the only thing between a browser and a column the renderer will later
 * read back through `fromRow`, which throws. Returning the issues rather than
 * a boolean is what lets the editor point at the field.
 */
export function normaliseRecipe(
  id: string,
  body: Record<string, unknown>,
): { ok: true; recipe: Recipe } | { ok: false; issues: string[] } {
  const parsed = recipeSchema.safeParse({ ...body, id });
  if (parsed.success) return { ok: true, recipe: parsed.data };
  return {
    ok: false,
    issues: parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`),
  };
}

function record(recipe: Recipe, legacyId: string | null): RecipeRecord {
  return { recipe, legacyId, updatedAt: new Date().toISOString() };
}

export async function insertRecipeRecord(recipe: Recipe): Promise<void> {
  if (isRecipeDevStore()) {
    devUpsertRecipe(record(recipe, null));
    return;
  }
  const { error } = await contentAdmin().from('recipes').insert(toRow(recipe, null));
  if (error) throw new Error(error.message);
}

/**
 * Updates everything except the slug and the legacy id.
 *
 * The slug is immutable after creation and the content baseline says why: the
 * control plane's `recipe_comments`, `recipe_proposals`, `proposal_votes` and
 * `community_photos` all reference `recipe_slug` as a plain string, across a
 * project and an organisation boundary that no foreign key spans. Renaming one
 * orphans every comment on it, silently, with nothing to join back on.
 */
export async function updateRecipeRecord(recipe: Recipe): Promise<boolean> {
  if (isRecipeDevStore()) {
    const existing = devGetRecipe(recipe.id);
    if (!existing) return false;
    devUpsertRecipe(record({ ...recipe, slug: existing.recipe.slug }, existing.legacyId));
    return true;
  }

  const row = toRow(recipe, null);
  /* `slug` and `legacy_id` are dropped from the patch rather than sent
     unchanged: a patch that names a column is a patch that can change it, and
     the reason these two must not change is a cross-project one no constraint
     in this database can enforce. */
  const { slug: _slug, legacy_id: _legacyId, ...patch } = row;

  /* `.select('id')` is what makes a missing row an error. An
     `update ... where id = ?` that matches nothing is a *success* in
     PostgREST: no error, zero rows. Without this an editor saving a recipe
     somebody else had deleted would be told "Saved". */
  const { data, error } = await contentAdmin()
    .from('recipes')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', recipe.id)
    .select('id');

  if (error) throw new Error(error.message);
  return Array.isArray(data) && data.length > 0;
}

/**
 * Removal, and the only kind of removal ColorLab has.
 *
 * There is no hard delete here and there should not be one. `recipe_comments`,
 * `recipe_proposals`, `proposal_votes` and `community_photos` live on the
 * CONTROL project and reference `recipe_slug` as a plain string; Postgres
 * cannot cascade across two projects in two organisations, so a `delete from
 * recipes` orphans all four tables without an error and without a way to find
 * what was orphaned afterwards.
 *
 * `published = false` removes the recipe from every reader's path —
 * `source.ts` filters on it in all four readers — while leaving the slug in
 * place for those rows to keep pointing at. Articles and products do delete
 * for real, because neither has a referent on the other plane. The asymmetry
 * between the three admin screens is deliberate, and the editor says
 * "unpublish" rather than "delete" so it is not a surprise.
 */
export async function unpublishRecipe(id: string): Promise<boolean> {
  const existing = await getRecipeRecord(id);
  if (!existing) return false;
  return updateRecipeRecord({ ...existing.recipe, published: false });
}

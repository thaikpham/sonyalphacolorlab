import 'server-only';
import { contentAdmin } from '@/lib/supabase/server';
import { recipeSchema, type Recipe } from '../camera/schema';
import { fromRow, RECIPE_COLUMNS, toRow, type RecipeRow } from './row';
import { nameFor } from './names';
import type { RecipeRecord, UnreadableRecipe } from './admin-types';
import {
  devGetRecipe,
  devInsertRecipe,
  devListRecipes,
  devRecipeIds,
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
const ADMIN_COLUMNS = `${RECIPE_COLUMNS}, updated_at`;

type Row = RecipeRow & { updated_at?: string };

/**
 * A row becomes a record, or the reason it cannot.
 *
 * `fromRow` throws on a row that fails the schema, and on this screen that is
 * the wrong response: one malformed row would make the whole list unreachable,
 * including the rows an editor needs in order to fix it. A reader's path still
 * throws — `source.ts` is unchanged — because there a bad row is a bug that
 * should be loud rather than a row to be repaired.
 */
function toRecord(row: Row): RecipeRecord | { unreadable: string } {
  try {
    return {
      recipe: fromRow(row),
      legacyId: row.legacy_id ?? null,
      updatedAt: typeof row.updated_at === 'string' ? row.updated_at : '',
    };
  } catch (err) {
    console.error('[admin/recipes] unreadable row:', row.id, err);
    return { unreadable: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Every row, with the ones `fromRow` refuses kept apart rather than dropped.
 *
 * Dropped, such a row — a script's write, the SQL editor, a range narrowed in
 * `constants.ts` — never appeared on the editor's list while it broke the
 * public grid, and only a hand-made DELETE could reach it. The editor lists
 * them with one action, Unpublish, which `unpublishRecipe` can do without
 * parsing the row.
 */
export async function listRecipeRows(): Promise<{
  records: RecipeRecord[];
  unreadable: UnreadableRecipe[];
}> {
  if (isRecipeDevStore()) return { records: devListRecipes(), unreadable: [] };

  const { data, error } = await contentAdmin()
    .from('recipes')
    .select(ADMIN_COLUMNS)
    .order('id', { ascending: true });

  if (error || !Array.isArray(data)) throw new Error(error?.message ?? 'listFailed');
  const records: RecipeRecord[] = [];
  const unreadable: UnreadableRecipe[] = [];
  for (const row of data as unknown as Row[]) {
    const out = toRecord(row);
    if ('unreadable' in out) {
      unreadable.push({ id: String(row.id), published: row.published === true, error: out.unreadable });
    } else {
      records.push(out);
    }
  }
  return { records, unreadable };
}

/** The readable rows only, for callers that resolve references by id. */
export async function listRecipeRecords(): Promise<RecipeRecord[]> {
  return (await listRecipeRows()).records;
}

export async function getRecipeRecord(id: string): Promise<RecipeRecord | null> {
  if (isRecipeDevStore()) return devGetRecipe(id);

  const { data, error } = await contentAdmin()
    .from('recipes')
    .select(ADMIN_COLUMNS)
    .eq('id', id)
    .maybeSingle();

  /* A failed read throws, and only an answered one may say "no such recipe".
     Every caller turns null into a 404, so returning it on error told an
     editor mid-outage that the recipe they were saving had been deleted. */
  if (error) throw new Error(error.message);
  if (!data) return null;
  const out = toRecord(data as unknown as Row);
  return 'unreadable' in out ? null : out;
}

// ---------------------------------------------------------------------------
// Allocation
// ---------------------------------------------------------------------------

/**
 * The next free `SCL-PP-###` / `SCL-CL-###`, or `PP-###` / `CL-###` once the
 * table holds the code shape.
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
  const code = format.toUpperCase();
  const ids = isRecipeDevStore() ? devRecipeIds() : await allIds();
  return nextIdAmong(code, ids);
}

/**
 * Numbers across both id shapes, so the same number is never issued twice
 * while the table is mid-migration, and answers in the shape the table
 * already uses: the CHECK accepts exactly one shape at a time, and the rows
 * say which. The shape is read across both formats, because a format with no
 * rows of its own still sits under the same CHECK.
 */
export function nextIdAmong(code: string, ids: readonly string[]): string {
  const sameFormat = new RegExp(`^(?:SCL-)?${code}-(\\d{3})$`);
  let highest = 0;
  for (const id of ids) {
    const m = sameFormat.exec(id);
    if (!m) continue;
    const n = Number(m[1]);
    if (n > highest) highest = n;
  }

  const next = highest + 1;
  if (next > 999) throw new Error('idSpaceExhausted');
  /* The migration renames every row in one transaction, so one code-shaped id
     in either format means the CHECK has moved; with none, the stored shape
     still holds. */
  const codeShape = ids.some((id) => /^(PP|CL)-\d{3}$/.test(id));
  const prefix = codeShape ? '' : 'SCL-';
  return `${prefix}${code}-${String(next).padStart(3, '0')}`;
}

async function allIds(): Promise<string[]> {
  const { data, error } = await contentAdmin().from('recipes').select('id');
  if (error || !Array.isArray(data)) throw new Error(error?.message ?? 'listFailed');
  return (data as { id: string }[]).map((r) => r.id);
}

/**
 * Kebab-case, diacritics folded. No longer where a slug comes from — a slug
 * is the code (`slugFor`), fixed at creation — but still the folding the
 * editor's tag box mirrors (`normaliseTag`, pinned in recipe-draft.test.ts).
 */
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
 * The name /admin writes for a recipe: `nameFor` computed from the recipe's
 * own validated settings (R3 of the 2026-10-28 names design). Nobody types a
 * name, so nothing in a request body can set one; a create and every save
 * recompute it.
 *
 * Named among every other readable recipe in the store, drafts included —
 * the set `seed:emit` and `library:sync` name the library across. Against
 * the published rows alone, saving any of 34 seed recipes without changing a
 * dial would rename it, because a draft that held its words would no longer
 * be there to push it aside. The recipe itself is left out and placed by its
 * number, as the seed places it.
 */
export async function computedRecipeName(recipe: Recipe): Promise<string> {
  const { records } = await listRecipeRows();
  return nameFor(
    recipe,
    records.map((r) => r.recipe).filter((r) => r.id !== recipe.id),
  );
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

/**
 * Inserts a new row, or answers `taken` when its id or slug already belongs to
 * another — the unique key deciding a race the allocator's two reads cannot.
 * The route allocates again on `taken`; anything else is a failure and throws.
 */
export async function insertRecipeRecord(recipe: Recipe): Promise<'inserted' | 'taken'> {
  if (isRecipeDevStore()) {
    return devInsertRecipe(record(recipe, null)) ? 'inserted' : 'taken';
  }
  const { error } = await contentAdmin().from('recipes').insert(toRow(recipe, null));
  if (error?.code === '23505') return 'taken';
  if (error) throw new Error(error.message);
  return 'inserted';
}

/** The version an update `.select()` answers with, or null for no row. */
function versionOf(data: unknown): string | null {
  const row = Array.isArray(data) ? (data[0] as { updated_at?: unknown } | undefined) : undefined;
  if (!row) return null;
  return typeof row.updated_at === 'string' ? row.updated_at : '';
}

/**
 * Updates everything except the slug and the legacy id — and only over the
 * version the editor opened.
 *
 * The slug is immutable after creation and the content baseline says why: the
 * control plane's `recipe_comments`, `recipe_proposals`, `proposal_votes` and
 * `community_photos` all reference `recipe_slug` as a plain string, across a
 * project and an organisation boundary that no foreign key spans. Renaming one
 * orphans every comment on it, silently, with nothing to join back on.
 *
 * `expectedUpdatedAt` is the precondition the product route has. The editor
 * sends its whole draft, `published` included, so without it a tab opened
 * before another tab unpublished a recipe put it back on the site with its
 * next typo fix, and both tabs said "Saved". Answers the row's new version, or
 * null when nothing matched — the row went, or moved on; the caller asks
 * which.
 */
export async function updateRecipeRecord(
  recipe: Recipe,
  expectedUpdatedAt: string,
): Promise<string | null> {
  if (isRecipeDevStore()) {
    const existing = devGetRecipe(recipe.id);
    if (!existing || existing.updatedAt !== expectedUpdatedAt) return null;
    const next = record({ ...recipe, slug: existing.recipe.slug }, existing.legacyId);
    devUpsertRecipe(next);
    return next.updatedAt;
  }

  const row = toRow(recipe, null);
  /* `slug` and `legacy_id` are dropped from the patch rather than sent
     unchanged: a patch that names a column is a patch that can change it, and
     the reason these two must not change is a cross-project one no constraint
     in this database can enforce. */
  const { slug: _slug, legacy_id: _legacyId, ...patch } = row;

  /* `.select()` is what makes a missing row an error. An
     `update ... where id = ?` that matches nothing is a *success* in
     PostgREST: no error, zero rows. Without this an editor saving a recipe
     somebody else had deleted would be told "Saved". `updated_at` is set here
     as the product route sets it; `recipes_touch` sets it again in the
     database, and the value that comes back is that one. */
  const { data, error } = await contentAdmin()
    .from('recipes')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', recipe.id)
    .eq('updated_at', expectedUpdatedAt)
    .select('id, updated_at');

  if (error) throw new Error(error.message);
  return versionOf(data);
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
 *
 * One column, by id, without reading the row first. It went through
 * `getRecipeRecord`, which drops a row `fromRow` cannot parse — so a row that
 * fails the schema (a script's write, or a range narrowed in `constants.ts`)
 * answered 404 here while still breaking the public grid, and nothing could
 * take it offline. No version precondition: taking a recipe off the site is
 * right whatever was saved since. Answers the new version, or null for no row.
 */
export async function unpublishRecipe(id: string): Promise<string | null> {
  if (isRecipeDevStore()) {
    const existing = devGetRecipe(id);
    if (!existing) return null;
    const next = record({ ...existing.recipe, published: false }, existing.legacyId);
    devUpsertRecipe(next);
    return next.updatedAt;
  }

  const { data, error } = await contentAdmin()
    .from('recipes')
    .update({ published: false, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id, updated_at');

  if (error) throw new Error(error.message);
  return versionOf(data);
}

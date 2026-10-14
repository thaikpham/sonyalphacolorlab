import 'server-only';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { hasContentConfig } from '@/lib/supabase/server';
import recipesSeed from '../../../data/recipes.seed.json';
import { recipeSchema, type Recipe } from '../camera/schema';
import type { RecipeRecord } from './admin-types';

/**
 * A file-backed recipe store, for local development with no Supabase.
 *
 * The same affordance `lib/lab/dev-store.ts` gives articles, and for the same
 * reason: `requireAdmin()` already hands out a super-admin session when
 * Supabase is unconfigured and `NODE_ENV` is `development`, so the gate opens
 * offline. Without a store behind it the recipe editor would be reachable and
 * inert — which is the state the article editor was in before its own dev
 * store, and the state the whole of ColorLab's admin is in today.
 *
 * **This can never run in production.** `isRecipeDevStore()` requires *both*
 * that Supabase is absent and that `NODE_ENV` is `development` — the same pair
 * `requireAdmin()` demands before it invents an admin. Anything weaker would
 * be a filesystem-backed CMS that a deployment could fall into when an
 * environment variable went missing, holding recipes nobody could see and
 * losing them on the next deploy.
 */

/** Local scratch, not a seed: written by the editor, gitignored. */
const FILE = join(process.cwd(), 'data', 'recipes.dev.json');

/* The version of a row this store has never written. Fixed rather than "now":
   a save names the version it opened as `expectedUpdatedAt`, and a version
   stamped at each read made every unsaved seed row stale to every save. */
const UNSAVED = new Date(0).toISOString();

export function isRecipeDevStore(): boolean {
  return !hasContentConfig() && process.env.NODE_ENV === 'development';
}

function assertDev() {
  if (!isRecipeDevStore()) {
    throw new Error('The development recipe store is not available here.');
  }
}

/**
 * Read the file, falling back to the shipped catalogue the first time.
 *
 * Seeding from `recipes.seed.json` rather than starting empty is the point: an
 * editor opening the screen for the first time gets 83 real recipes to work
 * on, which exercises the form far better than one blank recipe they have to
 * invent. `legacyId` is carried through so the dev store round-trips the same
 * shape the database holds.
 *
 * `intact` is false when the file exists and cannot be read as a list. Reads
 * then come back empty, so the screen still opens, but `readForWrite` refuses:
 * writing "empty plus one" back over a file with one stray comma in it is how
 * every other local recipe silently disappeared.
 */
function load(): { records: RecipeRecord[]; intact: boolean } {
  assertDev();
  let raw: string;
  try {
    raw = readFileSync(FILE, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') return { records: [], intact: false };
    const seed = recipesSeed as unknown as (Recipe & { legacyId?: string })[];
    const records = seed.map((r) => ({
      recipe: recipeSchema.parse(r),
      legacyId: r.legacyId ?? null,
      updatedAt: UNSAVED,
    }));
    return { records, intact: true };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { records: [], intact: false };
  }
  if (!Array.isArray(parsed)) return { records: [], intact: false };

  /* Parsed, not cast, for the same reason a database row is: this file is
     hand-editable and has a shorter path to a renderer than the table does.
     A row that no longer validates is dropped rather than thrown on — the
     alternative is one bad hand-edit making the whole screen unreachable. */
  const records = parsed.flatMap((row) => {
    if (typeof row !== 'object' || row === null) return [];
    const r = row as Record<string, unknown>;
    const recipe = recipeSchema.safeParse(r.recipe);
    if (!recipe.success) return [];
    return [
      {
        recipe: recipe.data,
        legacyId: typeof r.legacyId === 'string' ? r.legacyId : null,
        updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : UNSAVED,
      },
    ];
  });
  return { records, intact: true };
}

const readAll = (): RecipeRecord[] => load().records;

function readForWrite(): RecipeRecord[] {
  const { records, intact } = load();
  if (!intact) {
    throw new Error(`${FILE} is not a JSON list of recipes. Fix it, or delete it to reseed.`);
  }
  return records;
}

function writeAll(records: readonly RecipeRecord[]) {
  assertDev();
  mkdirSync(dirname(FILE), { recursive: true });
  writeFileSync(FILE, `${JSON.stringify(records, null, 2)}\n`, 'utf8');
}

export function devListRecipes(): RecipeRecord[] {
  return readAll().sort((a, b) => a.recipe.id.localeCompare(b.recipe.id));
}

export function devGetRecipe(id: string): RecipeRecord | null {
  return readAll().find((r) => r.recipe.id === id) ?? null;
}

export function devRecipeIds(): string[] {
  return readAll().map((r) => r.recipe.id);
}

export function devUpsertRecipe(record: RecipeRecord): void {
  const all = readForWrite();
  const i = all.findIndex((r) => r.recipe.id === record.recipe.id);
  if (i === -1) all.push(record);
  else all[i] = record;
  writeAll(all);
}

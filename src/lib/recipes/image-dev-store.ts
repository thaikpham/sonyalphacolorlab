import 'server-only';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { RecipeImageRecord } from './image-store';
import { isRecipeDevStore } from './dev-store';
import { publicRecipeImageUrl, recipeImageStem } from './images';
import { isVendored, VENDORED_IMAGES } from './vendored-images';

/**
 * Recipe photographs on a laptop with no Supabase.
 *
 * Offline, `public/` is writable and IS the origin, so an upload is live at
 * once with no vendor step and no deploy — the whole pipeline can be exercised
 * on a plane. The same affordance `public/lab/` gives the article editor.
 *
 * Two separate gitignored locations, because they answer different questions:
 * `public/recipes-dev/` holds the bytes, and `data/recipe-images.dev.json`
 * holds the association, order and alt text. Neither is a seed, though the
 * association starts as a copy of the deployed manifest. `public/recipes/` is
 * left untouched — it is committed, it is what the last deploy serves, and a
 * local upload writing into it would put 20 MB of scratch into a tracked
 * directory.
 *
 * **This can never run in production**, for the reason its sibling states at
 * length: `isRecipeDevStore()` needs an absent Supabase *and*
 * `NODE_ENV === 'development'`, and every function here asserts it again.
 */

/**
 * The URL prefix that serves the bytes back.
 *
 * `/recipes-dev/…` and not `/recipes/…`: the two must stay distinguishable so
 * an offline upload can never be mistaken for something the deploy is serving.
 */
export const DEV_IMAGE_URL_PREFIX = '/recipes-dev/';

/*
 * Literal segments, not a spread array.
 *
 * Turbopack traces `process.cwd()` joins statically to decide what to bundle.
 * Spreading segments defeats that: it cannot tell which subtree is reachable,
 * so it conservatively traces the whole project — every source file and all of
 * `public/` — into the serverless output, for a branch that only ever runs on a
 * laptop. The article dev store carries the same note and the same shape.
 */
const BYTES_ROOT = join(process.cwd(), 'public', 'recipes-dev');
const MANIFEST = join(process.cwd(), 'data', 'recipe-images.dev.json');

function assertDev() {
  if (!isRecipeDevStore()) {
    throw new Error('The development recipe image store is not available here.');
  }
}

/**
 * Where a dev-store photograph is served from.
 *
 * A row seeded from the deployed manifest names a file that is already in
 * `public/recipes`; anything uploaded on this laptop is in `public/recipes-dev`.
 * Upload slots skip every manifest path (see `nextSlot` in `image-store.ts`),
 * so the two can never name the same file.
 */
export function devImageUrl(storagePath: string): string {
  return isVendored(storagePath)
    ? publicRecipeImageUrl(storagePath)
    : `${DEV_IMAGE_URL_PREFIX}${storagePath}`;
}

/**
 * The deployed manifest, as rows, for the first read on a fresh clone.
 *
 * The same move `dev-store.ts` makes with `recipes.seed.json`. Starting empty
 * instead meant every vendored photograph vanished from the offline site and
 * from the image panel — the regression `vendor:images` was meant to end.
 */
function seedRows(): RecipeImageRecord[] {
  return VENDORED_IMAGES.map((i) => ({
    id: `dev-${i.recipeId}-${recipeImageStem(i.storagePath).split('/').pop()}`,
    recipeId: i.recipeId,
    storagePath: i.storagePath,
    alt: null,
    sort: i.sort,
    width: null,
    height: null,
  }));
}

/**
 * The manifest, and whether it is safe to write back over.
 *
 * A file that exists and does not parse reads as empty, so the panel still
 * opens, and is never overwritten: writing "empty plus one" back over a stray
 * comma is how every other local photograph silently disappeared.
 */
function load(): { rows: RecipeImageRecord[]; intact: boolean } {
  assertDev();
  let raw: string;
  try {
    raw = readFileSync(MANIFEST, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') return { rows: [], intact: false };
    return { rows: seedRows(), intact: true };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { rows: [], intact: false };
  }
  if (!Array.isArray(parsed)) return { rows: [], intact: false };

  const rows = parsed.flatMap((row) => {
    if (typeof row !== 'object' || row === null) return [];
    const r = row as Record<string, unknown>;
    if (typeof r.id !== 'string' || typeof r.storagePath !== 'string') return [];
    if (typeof r.recipeId !== 'string') return [];
    return [
      {
        id: r.id,
        recipeId: r.recipeId,
        storagePath: r.storagePath,
        alt: typeof r.alt === 'string' ? r.alt : null,
        sort: typeof r.sort === 'number' ? r.sort : 0,
        width: typeof r.width === 'number' ? r.width : null,
        height: typeof r.height === 'number' ? r.height : null,
      },
    ];
  });
  return { rows, intact: true };
}

const readAll = (): RecipeImageRecord[] => load().rows;

function readForWrite(): RecipeImageRecord[] {
  const { rows, intact } = load();
  if (!intact) {
    throw new Error(`${MANIFEST} is not a JSON list of photographs. Fix it, or delete it to reseed.`);
  }
  return rows;
}

function writeAll(rows: readonly RecipeImageRecord[]) {
  assertDev();
  mkdirSync(dirname(MANIFEST), { recursive: true });
  writeFileSync(MANIFEST, `${JSON.stringify(rows, null, 2)}\n`, 'utf8');
}

export function devListImages(recipeId?: string): RecipeImageRecord[] {
  const all = readAll().sort((a, b) => a.sort - b.sort);
  return recipeId ? all.filter((i) => i.recipeId === recipeId) : all;
}

export async function devWriteVariant(storagePath: string, bytes: Uint8Array): Promise<void> {
  assertDev();
  const target = join(BYTES_ROOT, storagePath);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, bytes);
}

export async function devUpsertImage(record: RecipeImageRecord): Promise<void> {
  const all = readForWrite();
  const i = all.findIndex((r) => r.id === record.id);
  if (i === -1) all.push(record);
  else all[i] = record;
  writeAll(all);
}

export async function devDeleteImage(id: string): Promise<boolean> {
  const all = readForWrite();
  const row = all.find((r) => r.id === id);
  if (!row) return false;
  writeAll(all.filter((r) => r.id !== id));

  const stem = row.storagePath.replace(/-(\d+)\.webp$/, '');
  await Promise.all(
    [320, 640, 1024].map((w) =>
      rm(join(BYTES_ROOT, `${stem}-${w}.webp`), { force: true }).catch(() => undefined),
    ),
  );
  return true;
}

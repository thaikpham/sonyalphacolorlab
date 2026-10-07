import 'server-only';
import { contentAdmin } from '@/lib/supabase/server';
import type { ProcessedLabImage } from '@/lib/lab/image-process';
import {
  PREVIEW_TTL_SECONDS,
  RECIPE_UPLOAD_BUCKET,
  recipeImagePath,
  recipeImageStem,
  type RecipeImageWidth,
} from './images';
import { isRecipeDevStore } from './dev-store';
import { VENDORED_IMAGES } from './vendored-images';
import {
  devDeleteImage,
  devListImages,
  devUpsertImage,
  devWriteVariant,
  DEV_IMAGE_URL_PREFIX,
} from './image-dev-store';

/**
 * Putting an uploaded photograph somewhere, without ever half-putting it.
 *
 * Storage objects and database rows do not share a transaction. The article
 * pipeline solves this by writing the row first, labelled `orphaned`, and
 * promoting it once the bytes land — it can, because `lab_assets` has a status
 * column built for it.
 *
 * `recipe_images` has no status column and should not grow one: it is a small
 * association table that the export and import scripts round-trip, and a state
 * machine in it would have to be understood by both. So this file inverts the
 * order instead — **objects first, then the row** — and the trade is explicit:
 *
 * - A failure after the objects land leaves bytes in a private bucket that
 *   nothing references. They cost storage, never egress, and the compensating
 *   delete below removes them in the ordinary case. Uploads never overwrite,
 *   so a leftover is stepped past rather than handed to a new photograph.
 * - A failure the other way round would leave a row pointing at nothing, and
 *   `vendor:images` would then fail the whole deploy on a download that 404s —
 *   turning one bad upload into a blocked release.
 *
 * The cheaper failure is the one we keep.
 */

export type RecipeImageRecord = {
  id: string;
  recipeId: string;
  storagePath: string;
  alt: string | null;
  sort: number;
  width: number | null;
  height: number | null;
};

export type ImageUploadFailure = 'recipeNotFound' | 'uploadFailed' | 'slotsFull';

export type ImageUploadResult =
  | { ok: true; image: RecipeImageRecord; previewUrl: string }
  | { ok: false; error: ImageUploadFailure };

/** `unique (recipe_id, sort)` is two digits wide in the path. */
const MAX_SLOTS = 100;

const ROW_COLUMNS = 'id, recipe_id, storage_path, alt, sort, width, height';

type Row = {
  id: string;
  recipe_id: string;
  storage_path: string;
  alt: string | null;
  sort: number;
  width: number | null;
  height: number | null;
};

const toRecord = (r: Row): RecipeImageRecord => ({
  id: r.id,
  recipeId: r.recipe_id,
  storagePath: r.storage_path,
  alt: r.alt,
  sort: r.sort,
  width: r.width,
  height: r.height,
});

export async function listRecipeImages(recipeId: string): Promise<RecipeImageRecord[]> {
  if (isRecipeDevStore()) return devListImages(recipeId);

  const { data, error } = await contentAdmin()
    .from('recipe_images')
    .select(ROW_COLUMNS)
    .eq('recipe_id', recipeId)
    .order('sort', { ascending: true });

  if (error || !Array.isArray(data)) throw new Error(error?.message ?? 'listFailed');
  return (data as unknown as Row[]).map(toRecord);
}

/** The two-digit slot baked into a stored path, or NaN for a shape that has none. */
function slotOf(storagePath: string): number {
  const stem = recipeImageStem(storagePath);
  return Number(stem.slice(stem.lastIndexOf('/') + 1));
}

/**
 * The next slot, which is not the same as the next display position.
 *
 * A slot is baked into the file name and therefore into a CDN-cached URL, so it
 * is allocated once and never reused. "Used" has to include the deployed
 * manifest as well as the table: deleting a vendored photograph removes its row
 * but not its file, and an upload that took the freed slot was shown as
 * already live, previewed the deleted photograph, and was skipped by
 * `vendor:uploads` because its path was already in the manifest. So it is the
 * slot after the highest one either source knows about, never a gap.
 *
 * `floor` is a slot Storage has just refused — see `uploadRecipeImage`.
 */
function nextSlot(recipeId: string, rows: readonly RecipeImageRecord[], floor = 0): number {
  const known = [
    ...rows.map((r) => r.storagePath),
    ...VENDORED_IMAGES.filter((i) => i.recipeId === recipeId).map((i) => i.storagePath),
  ]
    .map(slotOf)
    .filter(Number.isInteger);
  const slot = Math.max(floor, 0, ...known.map((n) => n + 1));
  return slot < MAX_SLOTS ? slot : -1;
}

/**
 * After the last photograph, whatever the gaps.
 *
 * Not the row count: a delete never renumbers, so after removing the first of
 * three the sorts are 1 and 2, the count names one that is taken, and
 * `unique (recipe_id, sort)` refused every later upload to that recipe.
 */
const nextSort = (rows: readonly RecipeImageRecord[]): number =>
  rows.reduce((m, r) => Math.max(m, r.sort + 1), 0);

/** Storage's answer for a path that already holds an object. */
const isConflict = (error: { statusCode?: unknown; status?: unknown }) =>
  String(error.statusCode ?? error.status) === '409';

/**
 * Two uploads can race for one slot and one sort — two tabs, two editors. Each
 * loss costs one more read of the list, so a handful of attempts is plenty.
 */
const UPLOAD_ATTEMPTS = 5;

type Attempt = ImageUploadResult | { ok: false; error: 'slotTaken' | 'sortTaken' };

export async function uploadRecipeImage(
  recipeId: string,
  image: ProcessedLabImage,
): Promise<ImageUploadResult> {
  if (isRecipeDevStore()) {
    /* Offline, the bytes go straight to a gitignored folder under `public/`,
       because on a laptop `public/` is writable and is the origin — so an
       upload is live locally at once, with no vendor step and no deploy. That
       is the same affordance `public/lab/` gives the article editor. */
    const existing = await listRecipeImages(recipeId);
    const slot = nextSlot(recipeId, existing);
    if (slot < 0) return { ok: false, error: 'slotsFull' };
    const paths = variantPaths(recipeId, slot, image);
    for (const p of paths) await devWriteVariant(p.path, p.bytes);
    const record: RecipeImageRecord = {
      id: `dev-${recipeId}-${slot}`,
      recipeId,
      storagePath: paths[paths.length - 1].path,
      alt: null,
      sort: nextSort(existing),
      width: image.width,
      height: image.height,
    };
    await devUpsertImage(record);
    return { ok: true, image: record, previewUrl: `${DEV_IMAGE_URL_PREFIX}${record.storagePath}` };
  }

  let floor = 0;
  for (let attempt = 0; attempt < UPLOAD_ATTEMPTS; attempt += 1) {
    const existing = await listRecipeImages(recipeId);
    const slot = nextSlot(recipeId, existing, floor);
    if (slot < 0) return { ok: false, error: 'slotsFull' };

    const result = await putOnce(recipeId, slot, nextSort(existing), image);
    if (result.ok) return result;
    switch (result.error) {
      /* Somebody else's objects are in this slot: a concurrent upload that got
         there first, or the leftovers of a failed one whose cleanup failed
         too. Either way they are not ours to overwrite, so step past it. */
      case 'slotTaken':
        floor = slot + 1;
        continue;
      /* A concurrent upload took the sort; our objects are gone, so re-read. */
      case 'sortTaken':
        continue;
      default:
        return { ok: false, error: result.error };
    }
  }
  console.error('[recipe-images] gave up after repeated collisions:', recipeId);
  return { ok: false, error: 'uploadFailed' };
}

function variantPaths(recipeId: string, slot: number, image: ProcessedLabImage) {
  return image.variants.map((v) => ({
    path: recipeImagePath(recipeId, slot, v.rung as RecipeImageWidth),
    bytes: v.bytes,
  }));
}

async function putOnce(
  recipeId: string,
  slot: number,
  sort: number,
  image: ProcessedLabImage,
): Promise<Attempt> {
  const paths = variantPaths(recipeId, slot, image);
  const bucket = contentAdmin().storage.from(RECIPE_UPLOAD_BUCKET);

  /* Objects first — see the header. `upsert: false`, and the compensating
     delete names only what THIS call wrote: with an overwrite, two uploads
     racing for a slot wrote over each other, and the loser's cleanup deleted
     the objects the winner's row pointed at. */
  const written: string[] = [];
  const undo = async () => {
    if (written.length > 0) await bucket.remove(written).catch(() => undefined);
  };

  for (const p of paths) {
    const { error } = await bucket.upload(p.path, p.bytes, {
      contentType: 'image/webp',
      upsert: false,
      /* A year, and immutable: the slot never changes for a given photograph,
         so a cached variant can never be stale. */
      cacheControl: '31536000',
    });
    if (error) {
      await undo();
      if (isConflict(error)) return { ok: false, error: 'slotTaken' };
      console.error('[recipe-images] variant upload failed:', p.path, error.message);
      return { ok: false, error: 'uploadFailed' };
    }
    written.push(p.path);
  }

  /* The 1024 variant is the row's `storage_path`, matching what
     `images.seed.json` records today; the loader derives the other two by
     rewriting the suffix. */
  const canonical = paths[paths.length - 1].path;

  const { data, error } = await contentAdmin()
    .from('recipe_images')
    .insert({
      recipe_id: recipeId,
      storage_path: canonical,
      sort,
      width: image.width,
      height: image.height,
    })
    .select(ROW_COLUMNS)
    .single();

  if (error || !data) {
    await undo();
    if (error?.code === '23505') return { ok: false, error: 'sortTaken' };
    /* A foreign-key violation is the recipe having been deleted underneath the
       upload, which is a 404 for the editor rather than a server fault. */
    const missing = error?.code === '23503';
    console.error('[recipe-images] row insert failed:', error?.message);
    return { ok: false, error: missing ? 'recipeNotFound' : 'uploadFailed' };
  }

  const record = toRecord(data as unknown as Row);
  return { ok: true, image: record, previewUrl: await signPreview(record.storagePath) };
}

/**
 * A short-lived URL for the private object.
 *
 * Never persisted anywhere. A signed URL embeds a token and an expiry, so
 * storing one in a row or in an article body is how a link that works today
 * becomes a broken image in half an hour.
 */
export async function signPreview(storagePath: string): Promise<string> {
  if (isRecipeDevStore()) return `${DEV_IMAGE_URL_PREFIX}${storagePath}`;

  const { data, error } = await contentAdmin()
    .storage.from(RECIPE_UPLOAD_BUCKET)
    .createSignedUrl(storagePath, PREVIEW_TTL_SECONDS);

  if (error || !data?.signedUrl) throw new Error(error?.message ?? 'signFailed');
  return data.signedUrl;
}

/*
 * Alt text, reordering and deletion all address a photograph THROUGH its
 * recipe, never by its id alone. The routes take both from the URL; filtering
 * on the id only made `/recipes/SCL-PP-001/images/<id of another recipe's
 * photograph>` act on the other recipe and report success.
 */

export async function setRecipeImageAlt(
  recipeId: string,
  id: string,
  alt: string | null,
): Promise<boolean> {
  if (isRecipeDevStore()) {
    const row = devListImages(recipeId).find((i) => i.id === id);
    if (!row) return false;
    await devUpsertImage({ ...row, alt });
    return true;
  }
  const { data, error } = await contentAdmin()
    .from('recipe_images')
    .update({ alt })
    .eq('id', id)
    .eq('recipe_id', recipeId)
    .select('id');
  if (error) throw new Error(error.message);
  return Array.isArray(data) && data.length > 0;
}

/**
 * Reordering, done as a two-pass shuffle.
 *
 * `unique (recipe_id, sort)` means a straight renumbering collides the moment
 * two rows pass each other, and `check (sort >= 0)` rules out parking them at
 * negative values — which is what this used to do, so the first UPDATE of
 * every reorder failed online. So every row is first moved ABOVE the highest
 * sort in use, where nothing can be, and then down to its final position.
 * Neither pass can collide: the parked values are all greater than `max`, and
 * `max` is at least n-1 because the n current sorts are distinct, so the final
 * 0..n-1 are always below them.
 *
 * Not atomic. A failure part-way leaves some rows parked high, which is still
 * a valid, ordered list, and the editor's next move renumbers it.
 */
export async function reorderRecipeImages(recipeId: string, orderedIds: string[]): Promise<boolean> {
  const current = await listRecipeImages(recipeId);
  const known = new Set(current.map((i) => i.id));
  if (orderedIds.length !== current.length || !orderedIds.every((id) => known.has(id))) {
    return false;
  }

  if (isRecipeDevStore()) {
    for (const [i, id] of orderedIds.entries()) {
      const row = current.find((r) => r.id === id)!;
      await devUpsertImage({ ...row, sort: i });
    }
    return true;
  }

  const park = nextSort(current);
  const db = contentAdmin();
  const setSort = async (id: string, sort: number) => {
    const { error } = await db
      .from('recipe_images')
      .update({ sort })
      .eq('id', id)
      .eq('recipe_id', recipeId);
    if (error) throw new Error(error.message);
  };
  for (const [i, id] of orderedIds.entries()) await setSort(id, park + i);
  for (const [i, id] of orderedIds.entries()) await setSort(id, i);
  return true;
}

/**
 * Removes the row and the private objects.
 *
 * It does NOT remove anything from `public/recipes`. Those files are committed
 * and are the live origin; taking a photograph off the site is a `vendor:images`
 * run and a deploy, exactly like putting one on. Deleting the public copy from
 * here would leave the working tree disagreeing with the last deploy and
 * nothing to say why.
 */
export async function deleteRecipeImage(recipeId: string, id: string): Promise<boolean> {
  if (isRecipeDevStore()) {
    if (!devListImages(recipeId).some((i) => i.id === id)) return false;
    return devDeleteImage(id);
  }

  const db = contentAdmin();
  const { data, error } = await db
    .from('recipe_images')
    .select(ROW_COLUMNS)
    .eq('id', id)
    .eq('recipe_id', recipeId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return false;

  const row = toRecord(data as unknown as Row);
  const stem = recipeImageStem(row.storagePath);

  const { error: delError } = await db
    .from('recipe_images')
    .delete()
    .eq('id', id)
    .eq('recipe_id', recipeId);
  if (delError) throw new Error(delError.message);

  /* After the row, and best-effort. An object with no row is invisible and
     costs storage; a row with no object breaks the next vendor run. */
  await contentAdmin()
    .storage.from(RECIPE_UPLOAD_BUCKET)
    .remove([320, 640, 1024].map((w) => `${stem}-${w}.webp`))
    .catch(() => undefined);

  return true;
}

/** Exported for the vendor script, which needs the bytes rather than a URL. */
export async function downloadRecipeVariant(storagePath: string): Promise<Uint8Array> {
  const { data, error } = await contentAdmin()
    .storage.from(RECIPE_UPLOAD_BUCKET)
    .download(storagePath);
  if (error || !data) throw new Error(error?.message ?? 'downloadFailed');
  return new Uint8Array(await data.arrayBuffer());
}

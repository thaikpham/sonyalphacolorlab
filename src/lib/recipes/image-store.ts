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
 *   delete below removes them in the ordinary case.
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

/**
 * The next free slot, which is not the same as the next display position.
 *
 * A slot is baked into the file name and therefore into a CDN-cached URL, so it
 * is allocated once and never reused while the photograph exists. `sort` is
 * what reordering changes.
 */
async function nextSlot(recipeId: string): Promise<number> {
  const used = new Set(
    (await listRecipeImages(recipeId)).map((i) => {
      const stem = recipeImageStem(i.storagePath);
      return Number(stem.slice(stem.lastIndexOf('/') + 1));
    }),
  );
  for (let n = 0; n < MAX_SLOTS; n += 1) if (!used.has(n)) return n;
  return -1;
}

export async function uploadRecipeImage(
  recipeId: string,
  image: ProcessedLabImage,
): Promise<ImageUploadResult> {
  const existing = await listRecipeImages(recipeId);
  const slot = await nextSlot(recipeId);
  if (slot < 0) return { ok: false, error: 'slotsFull' };
  const sort = existing.length;

  const paths = image.variants.map((v) => ({
    path: recipeImagePath(recipeId, slot, v.rung as RecipeImageWidth),
    bytes: v.bytes,
  }));

  if (isRecipeDevStore()) {
    /* Offline, the bytes go straight to a gitignored folder under `public/`,
       because on a laptop `public/` is writable and is the origin — so an
       upload is live locally at once, with no vendor step and no deploy. That
       is the same affordance `public/lab/` gives the article editor. */
    for (const p of paths) await devWriteVariant(p.path, p.bytes);
    const record: RecipeImageRecord = {
      id: `dev-${recipeId}-${slot}`,
      recipeId,
      storagePath: paths[paths.length - 1].path,
      alt: null,
      sort,
      width: image.width,
      height: image.height,
    };
    await devUpsertImage(record);
    return { ok: true, image: record, previewUrl: `${DEV_IMAGE_URL_PREFIX}${record.storagePath}` };
  }

  const bucket = contentAdmin().storage.from(RECIPE_UPLOAD_BUCKET);

  /* Objects first — see the header. `upsert: true` so a retry after a partial
     failure overwrites rather than colliding. */
  for (const p of paths) {
    const { error } = await bucket.upload(p.path, p.bytes, {
      contentType: 'image/webp',
      upsert: true,
      /* A year, and immutable: the slot never changes for a given photograph,
         so a cached variant can never be stale. */
      cacheControl: '31536000',
    });
    if (error) {
      await bucket.remove(paths.map((x) => x.path)).catch(() => undefined);
      console.error('[recipe-images] variant upload failed:', p.path, error.message);
      return { ok: false, error: 'uploadFailed' };
    }
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
    await bucket.remove(paths.map((x) => x.path)).catch(() => undefined);
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

export async function setRecipeImageAlt(id: string, alt: string | null): Promise<boolean> {
  if (isRecipeDevStore()) {
    const row = devListImages().find((i) => i.id === id);
    if (!row) return false;
    await devUpsertImage({ ...row, alt });
    return true;
  }
  const { data, error } = await contentAdmin()
    .from('recipe_images')
    .update({ alt })
    .eq('id', id)
    .select('id');
  if (error) throw new Error(error.message);
  return Array.isArray(data) && data.length > 0;
}

/**
 * Reordering, done as a two-pass shuffle.
 *
 * `unique (recipe_id, sort)` means a straight renumbering collides the moment
 * two rows pass each other. So every row is first moved to a negative sort —
 * which the CHECK constraint on the column forbids for real values and which
 * nothing else can be using — and then moved down to its final position.
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

  const db = contentAdmin();
  for (const [i, id] of orderedIds.entries()) {
    const { error } = await db
      .from('recipe_images')
      .update({ sort: -(i + 1) })
      .eq('id', id);
    if (error) throw new Error(error.message);
  }
  for (const [i, id] of orderedIds.entries()) {
    const { error } = await db.from('recipe_images').update({ sort: i }).eq('id', id);
    if (error) throw new Error(error.message);
  }
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
export async function deleteRecipeImage(id: string): Promise<boolean> {
  if (isRecipeDevStore()) return devDeleteImage(id);

  const db = contentAdmin();
  const { data, error } = await db
    .from('recipe_images')
    .select(ROW_COLUMNS)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return false;

  const row = toRecord(data as unknown as Row);
  const stem = recipeImageStem(row.storagePath);

  const { error: delError } = await db.from('recipe_images').delete().eq('id', id);
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

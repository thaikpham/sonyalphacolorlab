import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { adminGate } from '@/lib/auth/admin-gate';
import { CATALOGUE_TAG, IMMEDIATE } from '@/lib/catalogue-cache';
import { CONTENT_ADMIN_FROZEN, contentAdminWritesFrozen } from '@/lib/admin/content-freeze';
import { hasContentConfig } from '@/lib/supabase/server';
import { processLabImage, MAX_UPLOAD_BYTES } from '@/lib/lab/image-process';
import { RECIPE_ID_RE } from '@/lib/camera/schema';
import { isRecipeDevStore } from '@/lib/recipes/dev-store';
import { getRecipeRecord } from '@/lib/recipes/admin-store';
import {
  listRecipeImages,
  reorderRecipeImages,
  signPreview,
  uploadRecipeImage,
} from '@/lib/recipes/image-store';
import { publicRecipeImageUrl } from '@/lib/recipes/images';
import imagesSeed from '../../../../../../../data/images.seed.json';

/**
 * A recipe's photographs: list them, add one, reorder them.
 *
 * INVALIDATION. The rule is "invalidate exactly when a reader would see
 * something different", and that is environment-dependent here in a way it is
 * nowhere else in this codebase:
 *
 * - **Deployed** — an upload goes to a PRIVATE bucket and is not on the site.
 *   `public/recipes` is the origin, and a file arrives there only when
 *   `npm run vendor:uploads` runs and the result is deployed. Invalidating
 *   would throw away warm entries to re-render byte-identical pages.
 * - **Offline, development** — the bytes land in `public/recipes-dev`, which
 *   `imagesFor()` reads, so the write IS live and the sixty-second catalogue
 *   cache is the only thing standing between the editor and seeing it.
 *
 * Hence `revalidateOffline()` rather than a bare call: the guard is the rule,
 * and `content-write-boundaries.test.ts` asserts that every invalidation in
 * this file goes through it.
 *
 * `live` on each row is what the editor needs in order to say so: it compares
 * the stored path against `data/images.seed.json`, which IS what the last
 * deploy serves. One source for "is this on the site", so the screen and the
 * reader cannot disagree.
 */

type Params = { params: Promise<{ id: string }> };

/** See the header. Invalidates only where an image write is actually live. */
function revalidateOffline() {
  if (isRecipeDevStore()) revalidateTag(CATALOGUE_TAG, IMMEDIATE);
}

/** Paths the deployed site is serving right now. */
const VENDORED = new Set(
  (imagesSeed as { storagePath: string }[]).map((i) => i.storagePath),
);

/*
 * The gate is written out in every handler rather than hidden behind a helper.
 *
 * `admin-gate.test.ts` asserts the literal shape — `if (!gate.ok) return` with
 * the gate's own status, above every call that parses a body or opens a content
 * client — per route file, and it does so because a live incident on
 * 2026-09-11 turned a missing check into the authorisation path. A helper that
 * returns a response object reads better and makes that assertion structurally
 * unprovable. The repetition is the point.
 */

async function withUrls(recipeId: string) {
  const rows = await listRecipeImages(recipeId);
  return Promise.all(
    rows.map(async (r) => ({
      ...r,
      live: VENDORED.has(r.storagePath),
      /* A vendored photograph is shown from `public/` — no signing, no Storage
         request. Only a pending one costs a signed URL. */
      previewUrl: VENDORED.has(r.storagePath)
        ? publicRecipeImageUrl(r.storagePath)
        : await signPreview(r.storagePath),
    })),
  );
}

export async function GET(request: Request, { params }: Params) {
  const gate = await adminGate(request);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  if (!hasContentConfig() && !isRecipeDevStore()) {
    return NextResponse.json({ error: 'notConfigured' }, { status: 503 });
  }
  const { id } = await params;
  if (!RECIPE_ID_RE.test(id)) return NextResponse.json({ error: 'notFound' }, { status: 404 });

  try {
    return NextResponse.json({ images: await withUrls(id) });
  } catch (err) {
    console.error('[admin/recipes/images] list failed:', err);
    return NextResponse.json({ error: 'loadFailed' }, { status: 502 });
  }
}

export async function POST(request: Request, { params }: Params) {
  const gate = await adminGate(request);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  if (contentAdminWritesFrozen()) {
    return NextResponse.json(CONTENT_ADMIN_FROZEN, { status: 503 });
  }
  if (!hasContentConfig() && !isRecipeDevStore()) {
    return NextResponse.json({ error: 'notConfigured' }, { status: 503 });
  }
  const { id } = await params;
  if (!RECIPE_ID_RE.test(id)) return NextResponse.json({ error: 'notFound' }, { status: 404 });

  /* The recipe is confirmed before a multipart body is buffered: an upload for
     a recipe that does not exist would otherwise cost megabytes of parsing to
     reach a foreign-key violation. */
  let exists;
  try {
    exists = await getRecipeRecord(id);
  } catch (err) {
    console.error('[admin/recipes/images] read failed:', err);
    return NextResponse.json({ error: 'uploadFailed' }, { status: 502 });
  }
  if (!exists) return NextResponse.json({ error: 'notFound' }, { status: 404 });

  let file: File | null = null;
  try {
    const form = await request.formData();
    const candidate = form.get('file');
    if (candidate instanceof File) file = candidate;
  } catch {
    return NextResponse.json({ error: 'badRequest' }, { status: 400 });
  }
  if (!file) return NextResponse.json({ error: 'noFile' }, { status: 400 });
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: 'tooLarge' }, { status: 413 });
  }

  const processed = await processLabImage(new Uint8Array(await file.arrayBuffer()));
  if (!processed.ok) {
    /* `tooLarge`, `dimensionsTooLarge` and `unsupportedType` all name what the
       editor must change about the file, which "upload failed" does not. */
    return NextResponse.json({ error: processed.error }, { status: 400 });
  }

  let result;
  try {
    result = await uploadRecipeImage(id, processed.image);
  } catch (err) {
    console.error('[admin/recipes/images] upload failed:', err);
    return NextResponse.json({ error: 'uploadFailed' }, { status: 502 });
  }
  if (!result.ok) {
    const status = result.error === 'recipeNotFound' ? 404 : 502;
    return NextResponse.json({ error: result.error }, { status });
  }

  revalidateOffline();

  return NextResponse.json({
    ok: true,
    image: { ...result.image, live: false, previewUrl: result.previewUrl },
    /* Said on every successful upload, because it is the one thing about this
       pipeline an editor cannot see: the photograph is theirs now and the
       site's at the next deploy. */
    pendingVendor: !isRecipeDevStore(),
  });
}

export async function PATCH(request: Request, { params }: Params) {
  const gate = await adminGate(request);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  if (contentAdminWritesFrozen()) {
    return NextResponse.json(CONTENT_ADMIN_FROZEN, { status: 503 });
  }
  if (!hasContentConfig() && !isRecipeDevStore()) {
    return NextResponse.json({ error: 'notConfigured' }, { status: 503 });
  }
  const { id } = await params;
  if (!RECIPE_ID_RE.test(id)) return NextResponse.json({ error: 'notFound' }, { status: 404 });

  let body: { order?: unknown };
  try {
    body = (await request.json()) as { order?: unknown };
  } catch {
    return NextResponse.json({ error: 'badRequest' }, { status: 400 });
  }

  const order = Array.isArray(body.order) ? body.order.filter((x) => typeof x === 'string') : null;
  if (!order || order.length === 0) {
    return NextResponse.json({ error: 'badRequest' }, { status: 400 });
  }

  let done: boolean;
  try {
    done = await reorderRecipeImages(id, order);
  } catch (err) {
    console.error('[admin/recipes/images] reorder failed:', err);
    return NextResponse.json({ error: 'saveFailed' }, { status: 502 });
  }
  /* A partial list is refused rather than applied: reordering three of five
     photographs would silently renumber the other two. */
  if (!done) return NextResponse.json({ error: 'badRequest' }, { status: 400 });

  revalidateOffline();

  try {
    return NextResponse.json({ ok: true, images: await withUrls(id) });
  } catch {
    return NextResponse.json({ ok: true });
  }
}

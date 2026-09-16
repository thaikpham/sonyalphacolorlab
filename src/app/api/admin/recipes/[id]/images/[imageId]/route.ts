import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { adminGate } from '@/lib/auth/admin-gate';
import { CATALOGUE_TAG, IMMEDIATE } from '@/lib/catalogue-cache';
import { CONTENT_ADMIN_FROZEN, contentAdminWritesFrozen } from '@/lib/admin/content-freeze';
import { hasContentConfig } from '@/lib/supabase/server';
import { RECIPE_ID_RE } from '@/lib/camera/schema';
import { isRecipeDevStore } from '@/lib/recipes/dev-store';
import { deleteRecipeImage, setRecipeImageAlt } from '@/lib/recipes/image-store';

/**
 * One photograph: its alt text, or its removal.
 *
 * `DELETE` here is a real delete, unlike the recipe route's — an image row has
 * no cross-project referent, so nothing is orphaned by removing it. What it
 * does NOT touch is `public/recipes`: those files are committed and are what
 * the last deploy serves. Taking a photograph off the site is a
 * `vendor:images` run and a deploy, exactly like putting one on, so that the
 * working tree and the deployed site never disagree without a commit saying so.
 */

type Params = { params: Promise<{ id: string; imageId: string }> };

/** Only where an image write is actually live — see the sibling's header. */
function revalidateOffline() {
  if (isRecipeDevStore()) revalidateTag(CATALOGUE_TAG, IMMEDIATE);
}

/*
 * Written out per handler rather than behind a helper, for the reason its
 * sibling states: `admin-gate.test.ts` asserts the literal shape per route
 * file, and it does so because a live incident turned a missing check into the
 * authorisation path.
 */

export async function PATCH(request: Request, { params }: Params) {
  const gate = await adminGate(request);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  if (contentAdminWritesFrozen()) {
    return NextResponse.json(CONTENT_ADMIN_FROZEN, { status: 503 });
  }
  if (!hasContentConfig() && !isRecipeDevStore()) {
    return NextResponse.json({ error: 'notConfigured' }, { status: 503 });
  }
  const { id, imageId } = await params;
  if (!RECIPE_ID_RE.test(id) || !imageId) {
    return NextResponse.json({ error: 'notFound' }, { status: 404 });
  }

  let body: { alt?: unknown };
  try {
    body = (await request.json()) as { alt?: unknown };
  } catch {
    return NextResponse.json({ error: 'badRequest' }, { status: 400 });
  }

  /* Trimmed to nothing means "no alt text", which is a null column rather than
     an empty string — the renderer distinguishes a decorative image from one
     whose description somebody forgot. */
  const raw = typeof body.alt === 'string' ? body.alt.trim().slice(0, 300) : '';
  const alt = raw === '' ? null : raw;

  let done: boolean;
  try {
    done = await setRecipeImageAlt(imageId, alt);
  } catch (err) {
    console.error('[admin/recipes/images] alt failed:', err);
    return NextResponse.json({ error: 'saveFailed' }, { status: 502 });
  }
  if (!done) return NextResponse.json({ error: 'notFound' }, { status: 404 });

  revalidateOffline();

  return NextResponse.json({ ok: true, alt });
}

export async function DELETE(request: Request, { params }: Params) {
  const gate = await adminGate(request);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  if (contentAdminWritesFrozen()) {
    return NextResponse.json(CONTENT_ADMIN_FROZEN, { status: 503 });
  }
  if (!hasContentConfig() && !isRecipeDevStore()) {
    return NextResponse.json({ error: 'notConfigured' }, { status: 503 });
  }
  const { id, imageId } = await params;
  if (!RECIPE_ID_RE.test(id) || !imageId) {
    return NextResponse.json({ error: 'notFound' }, { status: 404 });
  }

  let done: boolean;
  try {
    done = await deleteRecipeImage(imageId);
  } catch (err) {
    console.error('[admin/recipes/images] delete failed:', err);
    return NextResponse.json({ error: 'saveFailed' }, { status: 502 });
  }
  if (!done) return NextResponse.json({ error: 'notFound' }, { status: 404 });

  revalidateOffline();

  /* `pendingVendor` on the way out too: the row is gone, and the file this
     deploy is serving is not. */
  return NextResponse.json({ ok: true, pendingVendor: !isRecipeDevStore() });
}

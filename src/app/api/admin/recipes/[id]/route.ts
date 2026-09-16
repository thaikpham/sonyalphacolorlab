import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { adminGate } from '@/lib/auth/admin-gate';
import { CONTENT_ADMIN_FROZEN, contentAdminWritesFrozen } from '@/lib/admin/content-freeze';
import { hasContentConfig } from '@/lib/supabase/server';
import { CATALOGUE_TAG, IMMEDIATE } from '@/lib/catalogue-cache';
import { RECIPE_ID_RE } from '@/lib/camera/schema';
import { isRecipeDevStore } from '@/lib/recipes/dev-store';
import {
  getRecipeRecord,
  normaliseRecipe,
  unpublishRecipe,
  updateRecipeRecord,
} from '@/lib/recipes/admin-store';

/**
 * One recipe: read it as an editor, save it, or take it off the site.
 *
 * `DELETE` unpublishes. It does not delete, and the verb is kept because it is
 * the verb the editor's "remove" action means — but nothing here issues a
 * `delete from recipes`, and `unpublishRecipe` explains at length why not:
 * `recipe_comments`, `recipe_proposals`, `proposal_votes` and
 * `community_photos` live on the CONTROL project and reference `recipe_slug`
 * as a plain string. Postgres cannot cascade across two projects in two
 * organisations, so a real delete orphans four tables silently and leaves
 * nothing to find them by. Articles and products delete for real because
 * neither has a referent on the other plane.
 */

type Params = { params: Promise<{ id: string }> };

function badId(id: string): boolean {
  return !RECIPE_ID_RE.test(id);
}

export async function GET(request: Request, { params }: Params) {
  const gate = await adminGate(request);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  if (!hasContentConfig() && !isRecipeDevStore()) {
    return NextResponse.json({ error: 'notConfigured' }, { status: 503 });
  }

  const { id } = await params;
  if (badId(id)) return NextResponse.json({ error: 'notFound' }, { status: 404 });

  try {
    const record = await getRecipeRecord(id);
    if (!record) return NextResponse.json({ error: 'notFound' }, { status: 404 });
    return NextResponse.json({ recipe: record });
  } catch (err) {
    console.error('[admin/recipes] read failed:', err);
    return NextResponse.json({ error: 'loadFailed' }, { status: 502 });
  }
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
  if (badId(id)) return NextResponse.json({ error: 'notFound' }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'badRequest' }, { status: 400 });
  }

  /* The slug is read back from the stored row rather than taken from the body.
     `updateRecipeRecord` drops the column from its patch as well — two layers
     for one rule, because the cost of getting it wrong is every comment on a
     recipe losing the row it pointed at, with no error and nothing to rejoin
     on afterwards. */
  let existing;
  try {
    existing = await getRecipeRecord(id);
  } catch (err) {
    console.error('[admin/recipes] read-before-write failed:', err);
    return NextResponse.json({ error: 'saveFailed' }, { status: 502 });
  }
  if (!existing) return NextResponse.json({ error: 'notFound' }, { status: 404 });

  const write = normaliseRecipe(id, { ...body, slug: existing.recipe.slug });
  if (!write.ok) {
    return NextResponse.json({ error: 'invalidRecipe', issues: write.issues }, { status: 400 });
  }

  let saved: boolean;
  try {
    saved = await updateRecipeRecord(write.recipe);
  } catch (err) {
    console.error('[admin/recipes] update failed:', err);
    return NextResponse.json({ error: 'saveFailed' }, { status: 502 });
  }
  if (!saved) return NextResponse.json({ error: 'notFound' }, { status: 404 });

  revalidateTag(CATALOGUE_TAG, IMMEDIATE);

  /* Refetched rather than echoed back: the row is what the next reader sees,
     and `updated_at` and any column a trigger touched are the store's answer,
     not the editor's. */
  try {
    const fresh = await getRecipeRecord(id);
    return NextResponse.json({ ok: true, recipe: fresh ?? { recipe: write.recipe } });
  } catch {
    return NextResponse.json({ ok: true });
  }
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

  const { id } = await params;
  if (badId(id)) return NextResponse.json({ error: 'notFound' }, { status: 404 });

  let done: boolean;
  try {
    done = await unpublishRecipe(id);
  } catch (err) {
    console.error('[admin/recipes] unpublish failed:', err);
    return NextResponse.json({ error: 'saveFailed' }, { status: 502 });
  }
  if (!done) return NextResponse.json({ error: 'notFound' }, { status: 404 });

  revalidateTag(CATALOGUE_TAG, IMMEDIATE);

  /* `unpublished`, not `deleted`. The editor renders the two differently and
     the row is still there — a client that assumed a delete would drop it from
     a list it can still legitimately show. */
  return NextResponse.json({ ok: true, unpublished: true });
}

import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { adminGate } from '@/lib/auth/admin-gate';
import { CONTENT_ADMIN_FROZEN, contentAdminWritesFrozen } from '@/lib/admin/content-freeze';
import { hasContentConfig } from '@/lib/supabase/server';
import { CATALOGUE_TAG, IMMEDIATE } from '@/lib/catalogue-cache';
import { RECIPE_ID_TRANSITION_RE } from '@/lib/camera/schema';
import { isRecipeDevStore } from '@/lib/recipes/dev-store';
import {
  getRecipeRecord,
  normaliseRecipe,
  computedRecipeName,
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
 *
 * `GET` is what the editor opens a recipe from: the row as stored and its
 * version, from one read, so the two describe the same row. A save names that
 * version as `expectedUpdatedAt`, and a row saved since — by another admin or
 * another tab — refuses the write with 409 `staleEdit`, exactly as a product
 * does (`products/[id]/route.ts`). The list row could be minutes old, and a
 * fresh version beside a stale draft would pass the check and write the stale
 * draft anyway.
 */

type Params = { params: Promise<{ id: string }> };

function badId(id: string): boolean {
  return !RECIPE_ID_TRANSITION_RE.test(id);
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
  /* Valid JSON is not necessarily an object. */
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'badRequest' }, { status: 400 });
  }

  /* Required. `updated_at` is `not null` on this table, so unlike a product
     there is no never-edited row to name with `null`. */
  const { expectedUpdatedAt: expected, ...fields } = body;
  if (typeof expected !== 'string') {
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
  /* Already behind: refuse before writing anything. The version filter on the
     write is what closes the window between this read and that write. */
  if (existing.updatedAt !== expected) {
    return NextResponse.json({ error: 'staleEdit' }, { status: 409 });
  }

  /* The name is never the body's, exactly as on a create: it is recomputed
     from the settings being saved, among the rest of the library, so a change
     to a dial renames the recipe and a typed name cannot. The stored name
     stands in until the settings have been validated. */
  const write = normaliseRecipe(id, { ...fields, name: existing.recipe.name, slug: existing.recipe.slug });
  if (!write.ok) {
    return NextResponse.json({ error: 'invalidRecipe', issues: write.issues }, { status: 400 });
  }

  let version: string | null;
  let recipe: typeof write.recipe;
  try {
    const named = await computedRecipeName(write.recipe);
    /* Nothing is written when every honest name for these settings is held
       by a recipe that looks different — never a second row with its words. */
    if (!named.ok) {
      return NextResponse.json(
        { error: 'nameTaken', issues: [`name: every honest name for these settings is held (${named.heldBy.join(', ')})`] },
        { status: 409 },
      );
    }
    recipe = { ...write.recipe, name: named.name };
    version = await updateRecipeRecord(recipe, expected);
  } catch (err) {
    console.error('[admin/recipes] update failed:', err);
    return NextResponse.json({ error: 'saveFailed' }, { status: 502 });
  }
  if (version === null) {
    /* Nothing matched: the row went, or it moved on between the read and the
       write. Asked again rather than guessed, so a deletion still reads as
       one. A failed re-read is not evidence of either, and nothing was
       written. */
    let after;
    try {
      after = await getRecipeRecord(id);
    } catch (err) {
      console.error('[admin/recipes] re-read after a missed write failed:', err);
      return NextResponse.json({ error: 'saveFailed' }, { status: 502 });
    }
    return after
      ? NextResponse.json({ error: 'staleEdit' }, { status: 409 })
      : NextResponse.json({ error: 'notFound' }, { status: 404 });
  }

  revalidateTag(CATALOGUE_TAG, IMMEDIATE);

  /* Refetched rather than echoed back: the row is what the next reader sees,
     and `updated_at` and any column a trigger touched are the store's answer,
     not the editor's. When the re-read fails, the validated recipe and the
     version the write answered are still a matching pair — the editor's next
     save needs that version, and an answer without one strands it. */
  const written = { recipe, legacyId: existing.legacyId, updatedAt: version };
  try {
    const fresh = await getRecipeRecord(id);
    return NextResponse.json({ ok: true, recipe: fresh ?? written });
  } catch {
    return NextResponse.json({ ok: true, recipe: written });
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

  let version: string | null;
  try {
    version = await unpublishRecipe(id);
  } catch (err) {
    console.error('[admin/recipes] unpublish failed:', err);
    return NextResponse.json({ error: 'saveFailed' }, { status: 502 });
  }
  if (version === null) return NextResponse.json({ error: 'notFound' }, { status: 404 });

  revalidateTag(CATALOGUE_TAG, IMMEDIATE);

  /* `unpublished`, not `deleted`. The editor renders the two differently and
     the row is still there — a client that assumed a delete would drop it from
     a list it can still legitimately show. */
  return NextResponse.json({ ok: true, unpublished: true, updatedAt: version });
}

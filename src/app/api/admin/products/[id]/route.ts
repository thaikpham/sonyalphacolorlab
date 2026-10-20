import { NextResponse } from 'next/server';
import { canManageCategory } from '@/lib/admin/category-roles';
import { adminGate } from '@/lib/auth/admin-gate';
import { CONTENT_ADMIN_FROZEN, contentAdminWritesFrozen } from '@/lib/admin/content-freeze';
import { revalidateTag } from 'next/cache';
import { CATALOGUE_TAG, IMMEDIATE } from '@/lib/catalogue-cache';
import { contentAdmin, hasContentConfig } from '@/lib/supabase/server';
import { contentProjectRef } from '@/lib/supabase/config';
import { productFromRow } from '@/lib/cameras/row';
import { ADMIN_PRODUCT_COLUMNS, type AdminProductRow } from '@/lib/admin/product-row';
import { productPatch, writeErrorFor } from '@/lib/cameras/product-write';
import type { SonyCamera } from '@/lib/cameras/types';

/**
 * The row as it is *right now*, read past every cache.
 *
 * This used to call the shared by-id reader, which goes through the tagged
 * catalogue cache — a sixty-second window in which this handler could be
 * looking at a copy that predates the save before it. Two edits a minute apart
 * were enough: the second filled the columns the body did not mention from the
 * stale copy and wrote the first edit away, with both saves reporting success.
 *
 * It is also the row the category/role check is made against, and a PE deciding
 * whether they may touch a product should not be answered from a cache.
 *
 * `contentAdmin()` rather than `contentRead()`: the caller has already passed
 * `adminGate()`, and an admin read should not depend on the anon grants.
 *
 * No seed fallback. What this returns is what the database holds, because it is
 * what the write below is checked against — a spec block borrowed from the seed
 * would let the route believe a row had specs it does not.
 *
 * `updatedAt` is the row's version; see `ADMIN_PRODUCT_COLUMNS`.
 */
type CurrentRow = { product: SonyCamera; updatedAt: string | null };

async function currentProductRow(id: string): Promise<CurrentRow | null> {
  const { data, error } = await contentAdmin()
    .from('sony_cameras')
    .select(ADMIN_PRODUCT_COLUMNS)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('[admin/products] current row read failed:', error.message);
    throw new Error('currentProductRow');
  }
  if (!data) return null;
  const row = data as AdminProductRow;
  return { product: productFromRow(row), updatedAt: row.updated_at ?? null };
}

/**
 * Saves one product: its text, photographs, features, spec sheet, highlights —
 * and its SKU, price, Sony Store URL, category and sub-categories, which used to
 * be read-only here, so an edit to any of them went nowhere.
 *
 * Everything the client sends is treated as untrusted, including the parts that
 * look structural. The editor is a trusted person; the request is not a trusted
 * object. `id` comes from the route, never the body, so a PATCH cannot be
 * pointed at a different product than the URL says — and `updated_by` comes
 * from the verified JWT, never a field, which is the same rule
 * `identity-not-from-body.test.ts` pins for the community writes. What a body
 * may change, and to what, is `productPatch()` — pure, and executed in
 * `product-write.test.ts`: the taxonomy decides the placement and the spec
 * kind, the price text is derived, and the role must cover the category the
 * product is in AND the one it is moving to.
 *
 * `expectedUpdatedAt` is required: the version the editor opened the row at,
 * from `GET` below or the previous save's answer. A row saved since then — by
 * another admin, or by the same admin in another tab — refuses the write with
 * 409 `staleEdit`. Without it the second of two saves silently reverted the
 * first, and both screens said "Đã lưu". `null` is a real version: a row no
 * admin has edited yet.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await adminGate(request);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  if (contentAdminWritesFrozen()) {
    return NextResponse.json(CONTENT_ADMIN_FROZEN, { status: 503 });
  }
  if (!hasContentConfig()) {
    return NextResponse.json({ error: 'notConfigured' }, { status: 503 });
  }

  const { id } = await params;

  let current: CurrentRow | null;
  try {
    current = await currentProductRow(id);
  } catch {
    return NextResponse.json({ error: 'contentUnavailable' }, { status: 503 });
  }
  if (!current) return NextResponse.json({ error: 'notFound' }, { status: 404 });
  const { product } = current;
  const role = gate.admin.role;
  if (!canManageCategory(role, product.category)) {
    return NextResponse.json({ error: 'notAllowedForCategory' }, { status: 403 });
  }

  let body: { expectedUpdatedAt?: unknown } & Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'badRequest' }, { status: 400 });
  }
  /* Valid JSON is not necessarily an object: `null` threw at `body.highlights`. */
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'badRequest' }, { status: 400 });
  }

  const expected = body.expectedUpdatedAt;
  if (expected !== null && typeof expected !== 'string') {
    return NextResponse.json({ error: 'badRequest' }, { status: 400 });
  }
  /* Already behind: refuse before writing anything. The filter on the update
     below is what closes the window between this read and that write. */
  if (current.updatedAt !== expected) {
    return NextResponse.json({ error: 'staleEdit' }, { status: 409 });
  }

  /* Validated before anything is written, so a refusal writes nothing. The
     role is asked again for the TARGET category inside — a DI editor filing a
     camera under audio is refused there, not here. */
  const patch = productPatch(body, product, (category) => canManageCategory(role, category));
  if (!patch.ok) return NextResponse.json({ error: patch.error }, { status: patch.status });

  /* Only the columns this save changes. The route used to upsert a whole row
     with every other column copied from the read above — left over from when
     the product might not exist in the database yet and the upsert created it.
     `currentProductRow` answers 404 for that case now, so the insert half was
     dead, and the copy half rewrote prices and URLs it had no reason to touch. */
  const update: Record<string, unknown> = {
    ...patch.update,
    updated_at: new Date().toISOString(),
    updated_by: gate.admin.email,
  };

  /* `.select()` is what turns the write into proof. PostgREST answers an
     update that matched nothing with no error and zero rows, so without it a
     row deleted between the read and the write would report "saved". And the
     row that comes back is what the editor is handed: the stored values, after
     sanitising, rather than its own draft echoed back to it.

     The version filter is the precondition. `is` for a never-edited row:
     `eq.null` compares with `=`, which is never true for NULL, so every first
     edit would have read as stale. */
  let saved: AdminProductRow | null;
  try {
    const byId = contentAdmin().from('sony_cameras').update(update).eq('id', product.id);
    const { data, error } = await (expected === null
      ? byId.is('updated_at', null)
      : byId.eq('updated_at', expected)
    )
      .select(ADMIN_PRODUCT_COLUMNS)
      .maybeSingle();
    if (error) {
      /* 23505 here can only be the SKU index — the id is never written — and
         a taken SKU is the editor's to fix, not "could not save". */
      const refused = writeErrorFor(error);
      if (refused.error === 'saveFailed') console.error('[admin/products] update failed:', JSON.stringify(error));
      return NextResponse.json({ error: refused.error }, { status: refused.status });
    }
    saved = data as AdminProductRow | null;
  } catch (err) {
    console.error('[admin/products] update threw:', err);
    return NextResponse.json({ error: 'saveFailed' }, { status: 502 });
  }
  if (!saved) {
    /* Nothing matched: the row went, or it moved on between the read and the
       write. Asked again rather than guessed, so a deletion still reads as
       one. A failed re-read is not evidence of either. */
    let after: CurrentRow | null;
    try {
      after = await currentProductRow(product.id);
    } catch {
      return NextResponse.json({ error: 'contentUnavailable' }, { status: 503 });
    }
    return after
      ? NextResponse.json({ error: 'staleEdit' }, { status: 409 })
      : NextResponse.json({ error: 'notFound' }, { status: 404 });
  }

  // After the commit and only after it — see the create route for why.
  revalidateTag(CATALOGUE_TAG, IMMEDIATE);

  /* `project` names the database the row went to. There are two Supabase
     projects in two organisations, and the catalogue lives in the CONTENT one
     — an editor looking for their save in the control project's leftover
     `sony_cameras` copy finds nothing and concludes the save failed. */
  return NextResponse.json({
    ok: true,
    product: productFromRow(saved),
    updatedAt: saved.updated_at ?? null,
    project: contentProjectRef(process.env),
  });
}

/**
 * The row as stored, and its version — what the editor opens a product from.
 *
 * The admin page renders the public catalogue, which is cached and does not
 * carry `updated_at` (it is not granted to anon, and that page's HTML reaches
 * anyone who types the URL). A version is only meaningful beside the content it
 * versions, so both come from this one read: a fresh version over a stale
 * draft would pass the precondition and write the stale draft anyway.
 *
 * No category check: everything here but the version is public already, and
 * the PATCH above refuses a write the role does not cover.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await adminGate(request);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  if (!hasContentConfig()) {
    return NextResponse.json({ error: 'notConfigured' }, { status: 503 });
  }

  const { id } = await params;
  let current: CurrentRow | null;
  try {
    current = await currentProductRow(id);
  } catch {
    return NextResponse.json({ error: 'contentUnavailable' }, { status: 503 });
  }
  if (!current) return NextResponse.json({ error: 'notFound' }, { status: 404 });
  return NextResponse.json({ ok: true, product: current.product, updatedAt: current.updatedAt });
}

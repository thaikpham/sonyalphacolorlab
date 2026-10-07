import { NextResponse } from 'next/server';
import { canManageCategory } from '@/lib/auth/require-admin';
import { adminGate } from '@/lib/auth/admin-gate';
import { CONTENT_ADMIN_FROZEN, contentAdminWritesFrozen } from '@/lib/admin/content-freeze';
import { revalidateTag } from 'next/cache';
import { CATALOGUE_TAG, IMMEDIATE } from '@/lib/catalogue-cache';
import { contentAdmin, hasContentConfig } from '@/lib/supabase/server';
import { contentProjectRef } from '@/lib/supabase/config';
import { PRODUCT_COLUMNS, productFromRow, type ProductRow } from '@/lib/cameras/row';
import { SPEC_ROWS, type ProductSpecs, type SonyCamera } from '@/lib/cameras/types';
import { highlightsSchema } from '@/lib/cameras/highlights';

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
 */
async function currentProductRow(id: string): Promise<SonyCamera | null> {
  const { data, error } = await contentAdmin()
    .from('sony_cameras')
    .select(PRODUCT_COLUMNS)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('[admin/products] current row read failed:', error.message);
    throw new Error('currentProductRow');
  }
  return data ? productFromRow(data as ProductRow) : null;
}

/**
 * Saves one product's specs and features.
 *
 * Everything the client sends is treated as untrusted, including the parts that
 * look structural. The editor is a trusted person; the request is not a trusted
 * object. `id` comes from the route, never the body, so a PATCH cannot be
 * pointed at a different product than the URL says — and `updated_by` comes
 * from the verified JWT, never a field, which is the same rule
 * `identity-not-from-body.test.ts` pins for the community writes.
 */

type Body = {
  name?: unknown;
  fullName?: unknown;
  imageUrl?: unknown;
  galleryUrls?: unknown;
  specs?: Record<string, unknown>;
  features?: { en?: unknown; vi?: unknown };
  highlights?: unknown;
};

const asLines = (x: unknown): string[] =>
  Array.isArray(x)
    ? x.filter((l): l is string => typeof l === 'string').map((l) => l.trim()).filter(Boolean).slice(0, 40)
    : [];

/**
 * Keeps only the fields this product kind actually has, and only strings or
 * null. An unknown key is dropped rather than stored: the seed and the DB have
 * to stay the same shape, because `pull:supabase` writes one back into the
 * other and a stray key would survive into the file the tests read.
 */
export function sanitizeSpecs(input: Record<string, unknown>, existing: ProductSpecs): ProductSpecs {
  const kind = existing.kind;
  const out: Record<string, unknown> = { ...existing };

  for (const field of SPEC_ROWS[kind]) {
    if (!(field in input)) continue;
    const raw = input[field];
    if (raw === null || (typeof raw === 'string' && raw.trim() === '')) {
      out[field] = null;
      continue;
    }
    if (typeof raw !== 'string') continue;
    out[field] = raw.replace(/\b(Xấp xỉ|Khoảng)\s+/gi, '').trim().slice(0, 300);
  }

  if (typeof input.specsSource === 'string' && /^https?:\/\//.test(input.specsSource)) {
    out.specsSource = input.specsSource.trim().slice(0, 500);
  }

  out.specsMissing = SPEC_ROWS[kind].filter((f) => out[f] === null || out[f] === undefined).sort();
  return out as unknown as ProductSpecs;
}

/** The spec kinds a category may carry. Audio is the only one with a choice. */
const KINDS_FOR: Record<SonyCamera['category'], readonly ProductSpecs['kind'][]> = {
  camera: ['camera'],
  lens: ['lens'],
  accessory: ['accessory'],
  audio: ['headphone', 'speaker'],
};

/**
 * What `sanitizeSpecs` starts from when the row has no spec block yet.
 *
 * The catalogue readers fill a null `specs` column from the seed, so the editor
 * can show — and send — a full sheet for a row whose database copy has none.
 * Refusing that save with `noSpecBlock` refused the name and the features with
 * it. The kind comes from the body, but only a kind this product's category can
 * have is accepted, so a camera cannot be turned into a speaker by a request.
 */
export function blankSpecs(
  category: SonyCamera['category'],
  kind: unknown,
): ProductSpecs | null {
  const allowed = KINDS_FOR[category] ?? [];
  if (typeof kind !== 'string' || !allowed.includes(kind as ProductSpecs['kind'])) return null;
  const k = kind as ProductSpecs['kind'];
  const out: Record<string, unknown> = { kind: k, specsSource: '', specsMissing: [] };
  for (const field of SPEC_ROWS[k]) out[field] = null;
  if (k === 'accessory') out.keySpecs = [];
  return out as unknown as ProductSpecs;
}

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

  let product: SonyCamera | null;
  try {
    product = await currentProductRow(id);
  } catch {
    return NextResponse.json({ error: 'contentUnavailable' }, { status: 503 });
  }
  if (!product) return NextResponse.json({ error: 'notFound' }, { status: 404 });
  if (!canManageCategory(gate.admin.role, product.category)) {
    return NextResponse.json({ error: 'notAllowedForCategory' }, { status: 403 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'badRequest' }, { status: 400 });
  }

  /* Validated before `update` is built, so a refusal writes nothing. `null`
     clears the column; anything else must pass `highlightsSchema` and the
     product must be a camera — the sales-talk block has no meaning on a lens
     or an accessory. */
  let highlights: unknown | undefined;
  if (body.highlights !== undefined) {
    if (body.highlights === null) highlights = null;
    else {
      const parsed = highlightsSchema.safeParse(body.highlights);
      if (!parsed.success || product.category !== 'camera') {
        return NextResponse.json({ error: 'invalidHighlights' }, { status: 400 });
      }
      highlights = parsed.data;
    }
  }

  /* Only the columns this save changes. The route used to upsert a whole row
     with every other column copied from the read above — left over from when
     the product might not exist in the database yet and the upsert created it.
     `currentProductRow` answers 404 for that case now, so the insert half was
     dead, and the copy half rewrote prices and URLs it had no reason to touch. */
  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    updated_by: gate.admin.email,
  };

  if (typeof body.name === 'string' && body.name.trim()) {
    update.name = body.name.trim().slice(0, 200);
  }

  if (typeof body.fullName === 'string' && body.fullName.trim()) {
    update.full_name = body.fullName.trim().slice(0, 300);
  }

  if (typeof body.imageUrl === 'string' && body.imageUrl.trim()) {
    update.image_url = body.imageUrl.trim().slice(0, 500);
  }

  if (Array.isArray(body.galleryUrls)) {
    update.gallery_urls = body.galleryUrls
      .filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
      .map((u) => u.trim())
      .slice(0, 100);
  }

  if (body.specs && typeof body.specs === 'object') {
    const base = product.specs ?? blankSpecs(product.category, body.specs.kind);
    if (!base) return NextResponse.json({ error: 'noSpecBlock' }, { status: 409 });
    update.specs = sanitizeSpecs(body.specs, base);
  }

  if (body.features && typeof body.features === 'object') {
    update.features = { en: asLines(body.features.en), vi: asLines(body.features.vi) };
  }

  if (highlights !== undefined) update.highlights = highlights;

  /* `.select()` is what turns the write into proof. PostgREST answers an
     update that matched nothing with no error and zero rows, so without it a
     row deleted between the read and the write would report "saved". And the
     row that comes back is what the editor is handed: the stored values, after
     sanitising, rather than its own draft echoed back to it. */
  let saved: ProductRow | null;
  try {
    const { data, error } = await contentAdmin()
      .from('sony_cameras')
      .update(update)
      .eq('id', product.id)
      .select(PRODUCT_COLUMNS)
      .maybeSingle();
    if (error) {
      console.error('[admin/products] update failed:', JSON.stringify(error));
      return NextResponse.json({ error: 'saveFailed' }, { status: 502 });
    }
    saved = data as ProductRow | null;
  } catch (err) {
    console.error('[admin/products] update threw:', err);
    return NextResponse.json({ error: 'saveFailed' }, { status: 502 });
  }
  if (!saved) return NextResponse.json({ error: 'notFound' }, { status: 404 });

  // After the commit and only after it — see the create route for why.
  revalidateTag(CATALOGUE_TAG, IMMEDIATE);

  /* `project` names the database the row went to. There are two Supabase
     projects in two organisations, and the catalogue lives in the CONTENT one
     — an editor looking for their save in the control project's leftover
     `sony_cameras` copy finds nothing and concludes the save failed. */
  return NextResponse.json({
    ok: true,
    product: productFromRow(saved),
    project: contentProjectRef(process.env),
  });
}

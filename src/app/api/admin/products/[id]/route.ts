import { NextResponse } from 'next/server';
import { canManageCategory } from '@/lib/auth/require-admin';
import { adminGate } from '@/lib/auth/admin-gate';
import { CONTENT_ADMIN_FROZEN, contentAdminWritesFrozen } from '@/lib/admin/content-freeze';
import { revalidateTag } from 'next/cache';
import { CATALOGUE_TAG, IMMEDIATE } from '@/lib/catalogue-cache';
import { contentAdmin, hasContentConfig } from '@/lib/supabase/server';
import { SPEC_ROWS, type ProductSpecs, type SonyCamera } from '@/lib/cameras/types';

/**
 * The row as it is *right now*, read past every cache.
 *
 * This used to call the shared by-id reader, which goes through the tagged
 * catalogue cache — a sixty-second window in which this handler could be
 * looking at a copy that predates the save before it. Two edits a minute apart
 * were enough: the second built `fullRow` by filling unspecified columns from
 * the stale copy and upserted the first edit away, with both saves reporting
 * success.
 *
 * It is also the row the category/role check is made against, and a PE deciding
 * whether they may touch a product should not be answered from a cache.
 *
 * `contentAdmin()` rather than `contentRead()` because this needs the columns a
 * public select deliberately omits, and the caller has already passed
 * `adminGate()`.
 */
async function currentProductRow(id: string): Promise<SonyCamera | null> {
  const { data, error } = await contentAdmin()
    .from('sony_cameras')
    .select(
      'id, sku, name, full_name, category, sub_category_1, sub_category_2, price_vnd, price_formatted, url, image_url, gallery_urls, features, specs',
    )
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('[admin/products] current row read failed:', error.message);
    throw new Error('currentProductRow');
  }
  if (!data) return null;

  return {
    id: data.id,
    sku: data.sku,
    name: data.name,
    fullName: data.full_name,
    category: data.category as SonyCamera['category'],
    subCategory1: data.sub_category_1 || '',
    subCategory2: data.sub_category_2 || '',
    priceVnd: Number(data.price_vnd),
    priceFormatted: data.price_formatted,
    url: data.url,
    imageUrl: data.image_url,
    galleryUrls: (data.gallery_urls as string[] | null) ?? undefined,
    features: (data.features ?? []) as SonyCamera['features'],
    specs: (data.specs as SonyCamera['specs']) ?? undefined,
  };
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
    if (!product.specs) return NextResponse.json({ error: 'noSpecBlock' }, { status: 409 });
    update.specs = sanitizeSpecs(body.specs, product.specs);
  }

  if (body.features && typeof body.features === 'object') {
    update.features = { en: asLines(body.features.en), vi: asLines(body.features.vi) };
  }

  const fullRow = {
    id: product.id,
    sku: product.sku,
    name: (update.name as string) ?? product.name,
    full_name: (update.full_name as string) ?? product.fullName,
    category: product.category,
    sub_category_1: product.subCategory1,
    sub_category_2: product.subCategory2,
    price_vnd: product.priceVnd,
    price_formatted: product.priceFormatted,
    url: product.url,
    image_url: (update.image_url as string) ?? product.imageUrl,
    gallery_urls: (update.gallery_urls as string[]) ?? product.galleryUrls ?? [],
    features: update.features ?? product.features,
    specs: update.specs ?? product.specs,
    updated_at: update.updated_at,
    updated_by: update.updated_by,
  };

  try {
    const { error } = await contentAdmin().from('sony_cameras').upsert(fullRow, { onConflict: 'id' });
    if (error) {
      console.error('[admin/products] update failed:', JSON.stringify(error));
      return NextResponse.json({ error: 'saveFailed' }, { status: 502 });
    }
  } catch (err) {
    console.error('[admin/products] update threw:', err);
    return NextResponse.json({ error: 'saveFailed' }, { status: 502 });
  }

  // After the commit and only after it — see the create route for why.
  revalidateTag(CATALOGUE_TAG, IMMEDIATE);

  return NextResponse.json({
    ok: true,
    specs: update.specs ?? product.specs,
    features: update.features ?? product.features,
  });
}

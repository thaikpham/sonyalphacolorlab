import { NextResponse } from 'next/server';
import { requireAdmin, canManageCategory, NOT_ADMIN } from '@/lib/auth/require-admin';
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase/server';
import { getSonyCameraById } from '@/lib/cameras/data';
import { SPEC_ROWS, type ProductSpecs } from '@/lib/cameras/types';

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
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json(NOT_ADMIN, { status: 403 });
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'notConfigured' }, { status: 503 });
  }

  const { id } = await params;
  const product = await getSonyCameraById(id);
  if (!product) return NextResponse.json({ error: 'notFound' }, { status: 404 });
  if (!canManageCategory(admin.role, product.category)) {
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
    updated_by: admin.email,
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

  try {
    const { error } = await supabaseAdmin().from('sony_cameras').update(update).eq('id', id);
    if (error) {
      console.error('[admin/products] update failed:', JSON.stringify(error));
      return NextResponse.json({ error: 'saveFailed' }, { status: 502 });
    }
  } catch (err) {
    console.error('[admin/products] update threw:', err);
    return NextResponse.json({ error: 'saveFailed' }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    specs: update.specs ?? product.specs,
    features: update.features ?? product.features,
  });
}

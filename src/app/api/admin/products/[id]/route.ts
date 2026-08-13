import { NextResponse } from 'next/server';
import { requireAdmin, NOT_ADMIN } from '@/lib/auth/require-admin';
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
function sanitizeSpecs(input: Record<string, unknown>, existing: ProductSpecs): ProductSpecs {
  const kind = existing.kind;
  const out: Record<string, unknown> = { ...existing };
  const missing: string[] = [];

  for (const field of SPEC_ROWS[kind]) {
    const raw = input[field];
    if (raw === null || raw === undefined || (typeof raw === 'string' && raw.trim() === '')) {
      out[field] = null;
      missing.push(field);
      continue;
    }
    if (typeof raw !== 'string') continue;
    /* Sony's own prose qualifiers, the ones `specs.test.ts` rejects. Stripping
       them here means an admin pasting a row straight off the spec page gets a
       clean value instead of a red test run later. */
    out[field] = raw.replace(/\b(Xấp xỉ|Khoảng)\s+/gi, '').trim().slice(0, 300);
  }

  if (typeof input.specsSource === 'string' && /^https?:\/\//.test(input.specsSource)) {
    out.specsSource = input.specsSource.trim().slice(0, 500);
  }
  /* Derived, never accepted from the body: it must always describe the values
     actually stored, and a client that sends a stale list would make a filled
     row read as unpublished. */
  out.specsMissing = missing.sort();
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

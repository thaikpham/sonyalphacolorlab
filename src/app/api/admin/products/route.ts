import { NextResponse } from 'next/server';
import { canManageCategory } from '@/lib/admin/category-roles';
import { adminGate } from '@/lib/auth/admin-gate';
import { CONTENT_ADMIN_FROZEN, contentAdminWritesFrozen } from '@/lib/admin/content-freeze';
import { revalidateTag } from 'next/cache';
import { CATALOGUE_TAG, IMMEDIATE } from '@/lib/catalogue-cache';
import { contentAdmin, hasContentConfig } from '@/lib/supabase/server';
import { contentProjectRef } from '@/lib/supabase/config';
import { productFromRow } from '@/lib/cameras/row';
import { productCreate, writeErrorFor } from '@/lib/cameras/product-write';
import { ADMIN_PRODUCT_COLUMNS, type AdminProductRow } from '@/lib/admin/product-row';

/**
 * Creates a new camera/lens/accessory/audio product in Supabase.
 *
 * Gated by `adminGate(request)`. The editor is a trusted person, but the request
 * body is untrusted: `productCreate()` decides what may be stored, with the same
 * rules as an update. The placement must be one the catalogue filters by — the
 * public chips match `subCategory1` character for character, so a product filed
 * under free text sat beside its chip and never appeared under it. The spec kind
 * comes from the taxonomy, not from finding "loa" inside the label. And the
 * price text is derived, never read from the body: this route used to write
 * `₫` where every other row says `đ`.
 */
export async function POST(request: Request) {
  const gate = await adminGate(request);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  if (contentAdminWritesFrozen()) {
    return NextResponse.json(CONTENT_ADMIN_FROZEN, { status: 503 });
  }
  if (!hasContentConfig()) {
    return NextResponse.json({ error: 'notConfigured' }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'badRequest' }, { status: 400 });
  }
  /* Valid JSON is not necessarily an object: `null` threw at `body.sku`. */
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'badRequest' }, { status: 400 });
  }

  const role = gate.admin.role;
  const made = productCreate(body, (category) => canManageCategory(role, category));
  if (!made.ok) return NextResponse.json({ error: made.error }, { status: made.status });
  const newProduct = made.product;


  const cameraRow = {
    id: newProduct.id,
    sku: newProduct.sku,
    name: newProduct.name,
    full_name: newProduct.fullName,
    category: newProduct.category,
    sub_category_1: newProduct.subCategory1,
    sub_category_2: newProduct.subCategory2,
    price_vnd: newProduct.priceVnd,
    price_formatted: newProduct.priceFormatted,
    url: newProduct.url,
    image_url: newProduct.imageUrl,
    gallery_urls: newProduct.galleryUrls,
    features: newProduct.features,
    specs: newProduct.specs,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    updated_by: gate.admin.email,
  };

  /* The inserted row is selected back and handed to the editor, so the list
     shows what the database stored rather than what the form sent — and with
     its version, which the editor's first save of it has to name. */
  let saved: AdminProductRow;
  try {
    const { data, error } = await contentAdmin()
      .from('sony_cameras')
      .insert(cameraRow)
      .select(ADMIN_PRODUCT_COLUMNS)
      .single();
    if (error) {
      /* 23505 is a unique violation: the SKU (`skuTaken`) or the id derived
         from it (`duplicateProduct`) is already taken. That is the editor's to
         fix, and "could not save" gave them nothing to fix it with. */
      const refused = writeErrorFor(error);
      if (refused.error === 'saveFailed') console.error('[admin/products] create failed:', JSON.stringify(error));
      return NextResponse.json({ error: refused.error }, { status: refused.status });
    }
    saved = data as AdminProductRow;
  } catch (err) {
    console.error('[admin/products] create threw:', err);
    return NextResponse.json({ error: 'saveFailed' }, { status: 502 });
  }

  /* After the commit and only after it. The catalogue reads are wrapped in a
     tagged Data Cache with a sixty-second interval, so without this the new
     product is invisible for up to a minute — and an editor who cannot see
     what they just saved saves it again. Invalidating before the write, or on
     a failed one, throws away a good cache to show the same old rows. */
  revalidateTag(CATALOGUE_TAG, IMMEDIATE);

  return NextResponse.json({
    ok: true,
    product: productFromRow(saved),
    updatedAt: saved.updated_at ?? null,
    project: contentProjectRef(process.env),
  });
}

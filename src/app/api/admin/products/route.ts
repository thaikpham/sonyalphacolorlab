import { NextResponse } from 'next/server';
import { requireAdmin, canManageCategory, NOT_ADMIN } from '@/lib/auth/require-admin';
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase/server';
import { SPEC_ROWS, type ProductSpecs, type SonyCamera } from '@/lib/cameras/types';

/**
 * Creates a new camera/lens/accessory product in Supabase.
 *
 * Gated by `requireAdmin(request)`. The editor is a trusted person, but the request
 * body is untrusted and validated server-side.
 */

type CreateBody = {
  sku?: string;
  name?: string;
  fullName?: string;
  category?: 'camera' | 'lens' | 'accessory';
  subCategory1?: string;
  subCategory2?: string;
  priceVnd?: number;
  priceFormatted?: string;
  url?: string;
  imageUrl?: string;
  galleryUrls?: unknown;
  features?: { en?: unknown; vi?: unknown };
  specs?: Record<string, unknown>;
};

const asLines = (x: unknown): string[] =>
  Array.isArray(x)
    ? x.filter((l): l is string => typeof l === 'string').map((l) => l.trim()).filter(Boolean).slice(0, 40)
    : [];

function buildInitialSpecs(
  kind: 'camera' | 'lens' | 'accessory',
  inputSpecs: Record<string, unknown> = {},
): ProductSpecs {
  const fields = SPEC_ROWS[kind];
  const out: Record<string, unknown> = { kind };
  const missing: string[] = [];

  for (const field of fields) {
    const raw = inputSpecs[field];
    if (raw === null || raw === undefined || (typeof raw === 'string' && raw.trim() === '')) {
      out[field] = null;
      missing.push(field);
    } else if (typeof raw === 'string') {
      out[field] = raw.replace(/\b(Xấp xỉ|Khoảng)\s+/gi, '').trim().slice(0, 300);
    } else {
      out[field] = null;
      missing.push(field);
    }
  }

  if (typeof inputSpecs.specsSource === 'string' && /^https?:\/\//.test(inputSpecs.specsSource)) {
    out.specsSource = inputSpecs.specsSource.trim().slice(0, 500);
  } else {
    out.specsSource = 'https://www.sony.com.vn';
  }

  out.specsMissing = missing.sort();
  return out as unknown as ProductSpecs;
}

export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json(NOT_ADMIN, { status: 403 });
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'notConfigured' }, { status: 503 });
  }

  let body: CreateBody;
  try {
    body = (await request.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: 'badRequest' }, { status: 400 });
  }

  const sku = (body.sku ?? '').trim();
  const name = (body.name ?? '').trim();
  const fullName = (body.fullName ?? name).trim();
  const category = body.category;
  if (!category || !canManageCategory(admin.role, category)) {
    return NextResponse.json({ error: 'notAllowedForCategory' }, { status: 403 });
  }
  const subCategory1 = (body.subCategory1 ?? '').trim();
  const subCategory2 = (body.subCategory2 ?? '').trim();
  const priceVnd = typeof body.priceVnd === 'number' ? body.priceVnd : 0;
  const priceFormatted = (body.priceFormatted ?? '').trim() || (priceVnd > 0 ? `${priceVnd.toLocaleString('vi-VN')} ₫` : 'Liên hệ');
  const url = (body.url ?? '').trim() || 'https://www.sony.com.vn';
  const imageUrl = (body.imageUrl ?? '').trim() || '/logo.png';
  const galleryUrls = Array.isArray(body.galleryUrls)
    ? body.galleryUrls.filter((u): u is string => typeof u === 'string' && u.trim().length > 0).map((u) => u.trim())
    : [imageUrl].filter((u) => u && u !== '/logo.png');

  if (!sku || !name || !category || !subCategory1) {
    return NextResponse.json({ error: 'badRequest' }, { status: 400 });
  }

  if (!['camera', 'lens', 'accessory'].includes(category)) {
    return NextResponse.json({ error: 'badRequest' }, { status: 400 });
  }

  const cleanSkuId = sku.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  const id = `sony-${cleanSkuId || Date.now()}`;

  const kind = category;
  const specs = buildInitialSpecs(kind, body.specs || {});
  const features = {
    en: asLines(body.features?.en),
    vi: asLines(body.features?.vi),
  };

  const newProduct: SonyCamera = {
    id,
    sku,
    name,
    fullName,
    category,
    subCategory1,
    subCategory2,
    priceVnd,
    priceFormatted,
    url,
    imageUrl,
    galleryUrls,
    features,
    specs,
  };

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
    updated_by: admin.email,
  };

  try {
    const { error } = await supabaseAdmin().from('sony_cameras').insert(cameraRow);
    if (error) {
      console.error('[admin/products] create failed:', JSON.stringify(error));
      return NextResponse.json({ error: 'saveFailed' }, { status: 502 });
    }
  } catch (err) {
    console.error('[admin/products] create threw:', err);
    return NextResponse.json({ error: 'saveFailed' }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    product: newProduct,
  });
}

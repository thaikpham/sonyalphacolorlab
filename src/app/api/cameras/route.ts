import { NextResponse } from 'next/server';
import { getSonyCameras } from '@/lib/cameras/data';
import type { ProductCategory } from '@/lib/cameras/types';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = (searchParams.get('category') as ProductCategory) || 'all';
  const subCategory1 = searchParams.get('subCategory1') || undefined;
  const subCategory2 = searchParams.get('subCategory2') || undefined;
  const search = searchParams.get('search') || undefined;
  const sortBy = (searchParams.get('sortBy') as 'price-asc' | 'price-desc' | 'name' | 'sku') || undefined;

  try {
    const cameras = await getSonyCameras({ category, subCategory1, subCategory2, search, sortBy });
    return NextResponse.json({ ok: true, cameras, count: cameras.length });
  } catch (err) {
    console.error('[API /api/cameras] Failed to fetch cameras:', err);
    return NextResponse.json({ ok: false, error: 'Failed to fetch product catalog' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { getSonyCameras } from '@/lib/cameras/data';
import type { CameraCategory } from '@/lib/cameras/types';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = (searchParams.get('category') as CameraCategory) || 'all';
  const search = searchParams.get('search') || undefined;
  const sortBy = (searchParams.get('sortBy') as 'price-asc' | 'price-desc' | 'name' | 'sku') || undefined;

  try {
    const cameras = await getSonyCameras({ category, search, sortBy });
    return NextResponse.json({ ok: true, cameras, count: cameras.length });
  } catch (err) {
    console.error('[API /api/cameras] Failed to fetch cameras:', err);
    return NextResponse.json({ ok: false, error: 'Failed to fetch camera catalog' }, { status: 500 });
  }
}

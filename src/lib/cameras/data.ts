import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isSupabaseConfigured, supabaseRead } from '@/lib/supabase/server';
import type { CameraCategory, SonyCamera } from './types';

let cachedSeedCameras: SonyCamera[] | null = null;

export function getSeedCameras(): SonyCamera[] {
  if (cachedSeedCameras) return cachedSeedCameras;
  try {
    const filePath = join(process.cwd(), 'data', 'sony-cameras.seed.json');
    const content = readFileSync(filePath, 'utf8');
    cachedSeedCameras = JSON.parse(content) as SonyCamera[];
    return cachedSeedCameras;
  } catch (err) {
    console.error('Failed to load sony-cameras.seed.json:', err);
    return [];
  }
}

export async function getSonyCameras(options?: {
  category?: CameraCategory;
  search?: string;
  sortBy?: 'price-asc' | 'price-desc' | 'name' | 'sku';
}): Promise<SonyCamera[]> {
  const seed = getSeedCameras();

  let cameras: SonyCamera[] = [];

  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabaseRead()
        .from('sony_cameras')
        .select('id, sku, name, full_name, category, price_vnd, price_formatted, url, image_url, features')
        .order('price_vnd', { ascending: false });

      if (!error && Array.isArray(data) && data.length > 0) {
        cameras = data.map((row) => ({
          id: row.id,
          sku: row.sku,
          name: row.name,
          fullName: row.full_name,
          category: row.category as SonyCamera['category'],
          priceVnd: Number(row.price_vnd),
          priceFormatted: row.price_formatted,
          url: row.url,
          imageUrl: row.image_url,
          features: Array.isArray(row.features) ? (row.features as string[]) : [],
        }));
      } else {
        cameras = seed;
      }
    } catch {
      cameras = seed;
    }
  } else {
    cameras = seed;
  }

  // Apply Category Filter
  if (options?.category && options.category !== 'all') {
    cameras = cameras.filter((c) => c.category === options.category);
  }

  // Apply Search Filter
  if (options?.search && options.search.trim()) {
    const query = options.search.trim().toLowerCase();
    cameras = cameras.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.fullName.toLowerCase().includes(query) ||
        c.sku.toLowerCase().includes(query) ||
        c.features.some((f) => f.toLowerCase().includes(query)),
    );
  }

  // Apply Sort
  if (options?.sortBy) {
    switch (options.sortBy) {
      case 'price-asc':
        cameras.sort((a, b) => a.priceVnd - b.priceVnd);
        break;
      case 'price-desc':
        cameras.sort((a, b) => b.priceVnd - a.priceVnd);
        break;
      case 'name':
        cameras.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'sku':
        cameras.sort((a, b) => a.sku.localeCompare(b.sku));
        break;
    }
  }

  return cameras;
}

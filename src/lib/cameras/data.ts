import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isSupabaseConfigured, supabaseRead } from '@/lib/supabase/server';
import type { ProductCategory, SonyCamera } from './types';
import { splitFeatures } from './features';

let cachedSeedCameras: SonyCamera[] | null = null;

function getSeedCameras(): SonyCamera[] {
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
  category?: ProductCategory;
  subCategory1?: string;
  subCategory2?: string;
  search?: string;
  sortBy?: 'price-asc' | 'price-desc' | 'name' | 'sku';
}): Promise<SonyCamera[]> {
  const seed = getSeedCameras();

  let cameras: SonyCamera[] = [];

  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabaseRead()
        .from('sony_cameras')
        /* Columns named, never `*`. `updated_by` is an email and this query runs
           under the anon key, which ships in the browser bundle — the same rule
           `no-email-leak.test.ts` pins for the community tables. */
        .select(
          'id, sku, name, full_name, category, sub_category_1, sub_category_2, price_vnd, price_formatted, url, image_url, features, specs',
        )
        .order('price_vnd', { ascending: false });

      const seedById = new Map(seed.map((c) => [c.id, c]));
      if (!error && Array.isArray(data) && data.length > 0) {
        cameras = data.map((row) => ({
          id: row.id,
          sku: row.sku,
          name: row.name,
          fullName: row.full_name,
          category: row.category as SonyCamera['category'],
          subCategory1: row.sub_category_1 || '',
          subCategory2: row.sub_category_2 || '',
          priceVnd: Number(row.price_vnd),
          priceFormatted: row.price_formatted,
          url: row.url,
          imageUrl: row.image_url,
          /* Either shape passes through untouched; `featureList()` resolves it
             at render. Coercing to `string[]` here would flatten the admin's
             Vietnamese away. */
          features: (row.features ?? []) as SonyCamera['features'],
          /* A row edited before migration 0008 has no specs column value; the
             seed's block is the fallback so the table does not empty out. */
          specs: (row.specs as SonyCamera['specs']) ?? seedById.get(row.id)?.specs,
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

  // Apply Main Category Filter
  if (options?.category && options.category !== 'all') {
    cameras = cameras.filter((c) => c.category === options.category);
  }

  // Apply Sub-category 1 Filter
  if (options?.subCategory1 && options.subCategory1 !== 'all') {
    cameras = cameras.filter((c) => c.subCategory1 === options.subCategory1);
  }

  // Apply Sub-category 2 Filter
  if (options?.subCategory2 && options.subCategory2 !== 'all') {
    cameras = cameras.filter((c) => c.subCategory2 === options.subCategory2);
  }

  // Apply Search Filter
  if (options?.search && options.search.trim()) {
    const query = options.search.trim().toLowerCase();
    cameras = cameras.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.fullName.toLowerCase().includes(query) ||
        c.sku.toLowerCase().includes(query) ||
        c.subCategory1.toLowerCase().includes(query) ||
        c.subCategory2.toLowerCase().includes(query) ||
        /* Both locales, not just the active one: a Vietnamese query should still
           reach a product whose bullets have only been written in English. */
        [...splitFeatures(c.features).en, ...splitFeatures(c.features).vi].some((f) =>
          f.toLowerCase().includes(query),
        ),
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

export async function getSonyCameraById(id: string): Promise<SonyCamera | null> {
  const cameras = await getSonyCameras();
  return cameras.find((c) => c.id === id) || null;
}

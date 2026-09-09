import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cache } from 'react';
import { catalogueCache } from '@/lib/catalogue-cache';
import { isSupabaseConfigured, supabaseRead } from '@/lib/supabase/server';
import { getSonyAudioById } from '@/lib/audio/data';
import { compareCameras, type ProductCategory, type SonyCamera, type WikiSort } from './types';
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

/* The wiki, the compare view, the admin list, the sitemap and
   `/api/search/predictive` all read this table; the last of those pulls all 94
   rows to return five suggestions, once per keystroke. See `catalogue-cache`. */
export const getSonyCameras = catalogueCache('getSonyCameras', _getSonyCameras);

async function _getSonyCameras(options?: {
  category?: ProductCategory;
  subCategory1?: string;
  subCategory2?: string;
  search?: string;
  sortBy?: WikiSort;
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
        .neq('category', 'audio')
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
          specs: (row.specs as SonyCamera['specs']) ?? seedById.get(row.id)?.specs,
          galleryUrls: seedById.get(row.id)?.galleryUrls,
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
    cameras = cameras.filter((c) => {
      if (
        c.name.toLowerCase().includes(query) ||
        c.fullName.toLowerCase().includes(query) ||
        c.sku.toLowerCase().includes(query) ||
        c.subCategory1.toLowerCase().includes(query) ||
        c.subCategory2.toLowerCase().includes(query)
      ) {
        return true;
      }
      /* Both locales, not just the active one: a Vietnamese query should still
         reach a product whose bullets have only been written in English. */
      const { en, vi } = splitFeatures(c.features);
      return (
        en.some((f) => f.toLowerCase().includes(query)) ||
        vi.some((f) => f.toLowerCase().includes(query))
      );
    });
  }

  // Apply Sort
  if (options?.sortBy) {
    /* On a copy, always.
     *
     * Every branch above can leave `cameras` aliased to `cachedSeedCameras` —
     * that is the whole point of the cache, and `filter` only breaks the alias
     * when a filter is actually asked for. `sort` mutates in place, so a single
     * request for `?sort=name` permanently reordered the module-level seed for
     * every later request in that process, and the catalogue's base order
     * silently became whatever the last sorter wanted. */
    cameras = [...cameras];
    cameras.sort(compareCameras(options.sortBy));
  }

  return cameras;
}

/* A point lookup over a whole-table read, so React `cache()` on top of the
   cross-request cache: the detail route asks in `generateMetadata` and again in
   the page body, and this way the second call never reaches the cache store. */
export const getSonyCameraById = cache(async (id: string): Promise<SonyCamera | null> => {
  const cameras = await getSonyCameras();
  return cameras.find((c) => c.id === id) || null;
});

export const getSonyProductById = cache(async (id: string): Promise<SonyCamera | null> => {
  const camera = await getSonyCameraById(id);
  if (camera) return camera;
  return getSonyAudioById(id);
});


import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isSupabaseConfigured, supabaseRead } from '@/lib/supabase/server';
import { compareCameras, type SonyCamera, type WikiSort } from '@/lib/cameras/types';

/**
 * The audio catalogue — headphones and speakers.
 *
 * Its own seed and its own reader, kept apart from `cameras/data.ts` because
 * the two catalogues have different sources and different release cadences:
 * the camera rows come from product pages on sony.com.vn, these come from the
 * FY26 comparison sheets, which are reissued as a set once a year. Mixing them
 * into one file would make "what did FY26 change" unanswerable.
 *
 * They share the `SonyCamera` shape and the `compareCameras` comparator on
 * purpose. The catalogue grid, the sort control and the search box are one
 * component serving both routes; forking them would be two copies of the same
 * ordering rules, which is exactly the drift `compareCameras` was written to
 * end.
 *
 * Now connected to Supabase when configured so the admin editor (/admin/pe) can
 * update and read audio products seamlessly.
 */

let cached: SonyCamera[] | null = null;

function getSeedAudio(): SonyCamera[] {
  if (cached) return cached;
  try {
    const filePath = join(process.cwd(), 'data', 'sony-audio.seed.json');
    cached = JSON.parse(readFileSync(filePath, 'utf8')) as SonyCamera[];
    return cached;
  } catch (err) {
    console.error('Failed to load sony-audio.seed.json:', err);
    return [];
  }
}

export async function getSonyAudio(options?: { sortBy?: WikiSort }): Promise<SonyCamera[]> {
  const seed = getSeedAudio();

  let products: SonyCamera[] = [];

  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabaseRead()
        .from('sony_cameras')
        .select(
          'id, sku, name, full_name, category, sub_category_1, sub_category_2, price_vnd, price_formatted, url, image_url, features, specs',
        )
        .eq('category', 'audio')
        .order('price_vnd', { ascending: false });

      const seedById = new Map(seed.map((c) => [c.id, c]));
      if (!error && Array.isArray(data) && data.length > 0) {
        products = data.map((row) => ({
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
          features: (row.features ?? []) as SonyCamera['features'],
          specs: (row.specs as SonyCamera['specs']) ?? seedById.get(row.id)?.specs,
          galleryUrls: seedById.get(row.id)?.galleryUrls,
        }));
      } else {
        products = seed;
      }
    } catch {
      products = seed;
    }
  } else {
    products = seed;
  }

  if (!options?.sortBy) return products;
  // On a copy: `sort` mutates, and the array above is the module-level cache.
  return [...products].sort(compareCameras(options.sortBy));
}

export async function getSonyAudioById(id: string): Promise<SonyCamera | null> {
  const audio = await getSonyAudio();
  return audio.find((p) => p.id === id) ?? null;
}


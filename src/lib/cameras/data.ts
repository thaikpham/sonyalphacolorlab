import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cache } from 'react';
import { catalogueCache } from '@/lib/catalogue-cache';
import { contentRead } from '@/lib/supabase/server';
import { contentOrOfflineSeed } from '@/lib/supabase/content-source';
import { PRODUCT_COLUMNS, productFromRow, type ProductRow } from './row';
import type { SonyCamera } from './types';

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

/* No filter or sort options. Every caller reads the whole table and narrows
   what comes back — the grid sorts with `compareCameras` on the client — and
   the options it used to take were reached by tests alone. They were also a
   hazard: a cached read's arguments are part of its cache key. */
async function _getSonyCameras(): Promise<SonyCamera[]> {
  const seed = getSeedCameras();

  /* Configuration decides the source, and nothing else. The old shape — try
     the database, `catch { cameras = seed }` — meant a content outage silently
     republished the Git-time snapshot of the catalogue, prices included, with
     no error anywhere. `data.length > 0` made it worse: an administrator who
     deleted the last product in a category would see the seed come back. */
  return contentOrOfflineSeed<SonyCamera[]>(
    'wiki.cameras',
    async () => {
      const { data, error } = await contentRead()
        .from('sony_cameras')
        /* Columns named, never `*`. `updated_by` is an email and this query runs
           under the anon key, which ships in the browser bundle — the same rule
           `no-email-leak.test.ts` pins for the community tables. */
        .select(PRODUCT_COLUMNS)
        .neq('category', 'audio')
        .order('price_vnd', { ascending: false });

      if (error) throw new Error(`sony_cameras: ${error.message}`);

      /* The seed still supplies `specs` and `galleryUrls` for rows that have
         none in the database — those are packaging, not content, and they are
         keyed by id so they cannot attach to the wrong product. What the seed
         no longer does is stand in for the *set* of products, or for a gallery
         the database holds: that is what made an admin's gallery edit vanish. */
      const seedById = new Map(seed.map((c) => [c.id, c]));
      return ((data ?? []) as ProductRow[]).map((row) => productFromRow(row, seedById.get(row.id)));
    },
    () => seed,
  );
}

/* A point lookup over a whole-table read, so React `cache()` on top of the
   cross-request cache: the detail route asks in `generateMetadata` and again in
   the page body, and this way the second call never reaches the cache store. */
export const getSonyCameraById = cache(async (id: string): Promise<SonyCamera | null> => {
  const cameras = await getSonyCameras();
  return cameras.find((c) => c.id === id) || null;
});

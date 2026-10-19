/**
 * Seed entry → content-project row, for `push:supabase`.
 *
 * Every column the seed can carry goes into the row. Highlights come back into
 * the seed through `pull:supabase` and alt text through `vendor:uploads`; a
 * builder that left them out rebuilt a project with camera pages on the
 * fallback bullets and photographs unlabelled, and `--overwrite` — which
 * replaces a row whole — blanked both on a live one.
 *
 * Out of the script so it can be tested: the script itself connects to a
 * project the moment it is imported.
 */

import { highlightsSchema, type Highlights } from '../../src/lib/cameras/highlights';
import type { SonyCamera } from '../../src/lib/cameras/types';

export type SeedImage = { recipeId: string; storagePath: string; sort: number; alt?: string };

export function imageRow(i: SeedImage) {
  return {
    recipe_id: i.recipeId,
    storage_path: i.storagePath,
    sort: i.sort,
    alt: i.alt ?? null,
  };
}

/** Throws on highlights the reader would reject: the push validates before it writes. */
export function productRow(p: SonyCamera) {
  let highlights: Highlights | null = null;
  if (p.highlights !== null && p.highlights !== undefined) {
    const parsed = highlightsSchema.safeParse(p.highlights);
    if (!parsed.success) {
      const detail = parsed.error.issues.map((i) => i.path.join('.') || '(root)').join(', ');
      throw new Error(`${p.id} highlights failed validation: ${detail}`);
    }
    highlights = parsed.data;
  }
  return {
    id: p.id,
    sku: p.sku,
    name: p.name,
    full_name: p.fullName,
    category: p.category,
    sub_category_1: p.subCategory1,
    sub_category_2: p.subCategory2,
    price_vnd: p.priceVnd,
    price_formatted: p.priceFormatted,
    url: p.url,
    image_url: p.imageUrl,
    gallery_urls: p.galleryUrls ?? [],
    features: p.features,
    specs: p.specs,
    highlights,
  };
}

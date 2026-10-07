/**
 * Maps a `sony_cameras` row to a `SonyCamera`, for every reader of the table.
 *
 * There were three copies of this mapping — the camera catalogue, the audio
 * catalogue and the admin save route — and they had drifted on the one column
 * that mattered: only the route selected `gallery_urls`. Both catalogues read
 * the gallery from the seed instead, so a gallery the admin saved reached the
 * database and was never read back. The editor reopened on the old photographs,
 * the public page kept them, and the save looked like it had not happened.
 *
 * Pure on purpose: no `server-only`, no client, no seed. The scripts import it
 * as well, and `pull:supabase` writing a different shape than the app reads is
 * the same drift one step further along.
 */

import type { LocalizedFeatures } from './features';
import { parseHighlights } from './highlights';
import type { ProductSpecs, SonyCamera } from './types';

/**
 * What a catalogue read selects. Named, never `*`: `updated_by` is an editor's
 * email address and the catalogue reads run under the anon key, which ships in
 * the browser bundle. Every column here must be granted to `anon` in BOTH
 * migration roots — `migration-roots.test.ts` executes them to check.
 */
export const PRODUCT_COLUMNS =
  'id, sku, name, full_name, category, sub_category_1, sub_category_2, price_vnd, price_formatted, url, image_url, gallery_urls, features, specs, highlights';

export type ProductRow = {
  id: string;
  sku: string;
  name: string;
  full_name: string;
  category: string;
  sub_category_1: string | null;
  sub_category_2: string | null;
  price_vnd: number | string;
  price_formatted: string;
  url: string;
  image_url: string;
  gallery_urls?: unknown;
  features: unknown;
  specs: unknown;
  highlights?: unknown;
};

/**
 * The stored gallery, or `undefined` when the row holds none.
 *
 * An array is the database's answer and wins, empty included: an editor who
 * cleared the gallery meant it. Only a null column — a row the gallery was never
 * written to — falls back to the seed, which is what "packaging for rows that
 * have none in the database" meant all along.
 */
export function galleryFromRow(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((u): u is string => typeof u === 'string' && u.trim() !== '');
}

/**
 * `seed` is the same product's seed entry, keyed by id by the caller. It
 * supplies `specs` and `galleryUrls` only where the row has none — never the
 * set of products, and never a column the database answered.
 */
export function productFromRow(row: ProductRow, seed?: SonyCamera): SonyCamera {
  return {
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
    galleryUrls: galleryFromRow(row.gallery_urls) ?? seed?.galleryUrls,
    /* Either shape passes through untouched; `featureList()` resolves it at
       render. Coercing to `string[]` here would flatten the Vietnamese away. */
    features: (row.features ?? []) as LocalizedFeatures,
    specs: (row.specs as ProductSpecs | null) ?? seed?.specs,
    /* No seed fallback: a null column is "no highlights", and the page then
       renders the feature bullets, which is the fallback. */
    highlights: parseHighlights(row.highlights, row.id),
  };
}

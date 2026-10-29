import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { slugAliases } from '@/lib/recipes/slug-aliases';

/**
 * What both gallery write paths share.
 *
 * A community photo arrives two ways: `POST /api/community-photos`, and as the
 * sample photograph of a proposal. The second path used to restate the insert
 * by hand and drifted from the first in every way that mattered — no photo cap,
 * a credit longer than the column's own CHECK, and the author's address in
 * `submitted_by`, a column the anon key could read.
 */

export const MAX_PHOTOS_PER_RECIPE = 40;

/**
 * Coarse origin marker for `community_photos.submitted_by`, kept for abuse
 * cleanup. Deliberately not an identity: 0019 narrowed the table's grant, but
 * an address in this column was a published address until then, and nothing
 * that reads it needs to know who the submitter is.
 */
export const clientKey = (req: Request) =>
  req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
  req.headers.get('x-real-ip') ??
  'local';

/**
 * Whether this URL is already in the recipe's gallery, hidden or not, under
 * any spelling of its slug.
 *
 * Moderation is `approved = false` and nothing else, so what keeps a hidden
 * link hidden is that sending it again is a duplicate rather than a fresh,
 * visible row. The unique key `(recipe_slug, image_url)` used to be enough.
 * It is not since slugs moved: reads match every spelling
 * (`slugAliases`), writes keep the one the request named, and a hidden row
 * under `pp-001` raises no 23505 for the same URL sent
 * under `mojave-sun`. So both write paths ask here first, across every
 * spelling, and treat a hit exactly as they treat a 23505.
 *
 * `error` is the read's own failure, returned rather than thrown so each
 * caller keeps its existing failure path. Two submissions racing under the
 * two spellings can still both land; the window is one round trip, and the
 * key still catches every race under one spelling.
 */
export async function photoInGallery(
  db: SupabaseClient,
  slug: string,
  imageUrl: string,
): Promise<{ taken: boolean; error: { message: string } | null }> {
  const { data, error } = await db
    .from('community_photos')
    .select('id')
    .in('recipe_slug', slugAliases(slug))
    .eq('image_url', imageUrl)
    .limit(1);
  if (error) return { taken: false, error };
  return { taken: (data ?? []).length > 0, error: null };
}

/**
 * How many photos count toward `MAX_PHOTOS_PER_RECIPE`: the visible ones
 * (`approved = true`), under every spelling of the slug. A photo an editor hid
 * is not on the page, so it no longer holds a place in the cap; it still
 * holds its link, through `photoInGallery`, so sending it again stays a
 * duplicate and stays hidden.
 *
 * `db` is the client the caller writes with, `controlAdmin()`: the service
 * role bypasses RLS and keeps the table's full grant (0019 narrowed anon and
 * authenticated only), so it may filter on `approved`. Anon could not — it
 * holds no grant on that column. `error` is returned, as `photoInGallery`'s is.
 */
export async function visiblePhotoCount(
  db: SupabaseClient,
  slug: string,
): Promise<{ count: number; error: { message: string } | null }> {
  const { count, error } = await db
    .from('community_photos')
    .select('id', { count: 'exact', head: true })
    .in('recipe_slug', slugAliases(slug))
    .eq('approved', true);
  if (error) return { count: 0, error };
  return { count: count ?? 0, error: null };
}

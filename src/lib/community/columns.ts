/**
 * What each community read selects: the public reads, and one admin read.
 *
 * Explicit columns, never `*`: `author_email` and `submitted_by` must not ride
 * along into a response the whole internet can fetch, and the anon role is
 * granted columns, not tables, so a column outside the grant fails the whole
 * query. Here rather than in the routes because a `route.ts` may export only
 * its handlers and segment config; `public-selects.test.ts` runs each list
 * against the control root as anon.
 */

/** `recipe_proposals` — the GET read and the POST insert's return. */
export const PROPOSAL_COLUMNS =
  'id, recipe_slug, title, author_name, author_avatar, sample_image_url, settings, white_balance, vote_count, created_at';

/** `recipe_comments` — the GET read and the POST insert's return. */
export const COMMENT_COLUMNS = 'id, recipe_slug, author_name, author_avatar, content, created_at';

/** `community_photos` — the gallery read. */
export const PHOTO_COLUMNS = 'image_url, author_name, author_social';

/**
 * `community_photos` — the moderation read in `/api/admin/community-photos`,
 * which is the one list here that is not public.
 *
 * It runs on the service role, which bypasses RLS and the column grant alike
 * and can read every column, `submitted_by` included — so on this path the list
 * is the only thing deciding what leaves the database. `id` and `approved` are
 * outside 0019's anon grant on purpose, which is why this list is never sent as
 * anon and why the public read leaves the `approved` filter to RLS.
 */
export const MODERATION_PHOTO_COLUMNS = 'id, image_url, author_name, approved, created_at';

/**
 * `community_photos` — what the moderation PATCH reads before it shows a
 * hidden photo: which recipe's cap to count, and whether the row is hidden.
 * Same service role, so the same rule: named columns, no address. Nothing of
 * it is sent back; the answer is the update's own row, through the mapper.
 */
export const MODERATION_TARGET_COLUMNS = 'recipe_slug, approved';

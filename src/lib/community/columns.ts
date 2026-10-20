/**
 * What each public community read selects.
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

import { z } from 'zod';

/**
 * Moderating community photos: what the admin route accepts, and the only
 * shape that leaves it.
 *
 * A contribution is visible the moment it is sent (`approved` defaults to
 * true), so moderation is after the fact: an editor hides a photo, and can show
 * it again. Hiding is `approved = false` and nothing else. There is no delete,
 * for the reason the gallery has no remove control: the unique key on
 * `(recipe_slug, image_url)` is what makes a re-submitted hidden link a
 * duplicate instead of a fresh, visible row.
 *
 * The public read never filters on `approved` itself. 0002's RLS policy does,
 * and 0019 grants anon no `approved` column to filter with — naming it there
 * would turn every gallery read into "permission denied".
 *
 * Client-safe: the screen imports the type, the routes the schema and mappers.
 */

/** The PATCH body: which photo, and whether readers see it. Nothing else. */
export const moderationPatchSchema = z.strictObject({
  id: z.uuid(),
  approved: z.boolean(),
});

export type ModerationPatch = z.infer<typeof moderationPatchSchema>;

/**
 * Every row of one recipe, hidden ones included — bounded, as every read is.
 * The submission routes cap a recipe at `MAX_PHOTOS_PER_RECIPE` *visible*
 * photos, and a hidden row no longer holds a place, so enough
 * submit-and-hide cycles can reach this ceiling from inside the app. The list
 * then shows the newest 200 rows only, and `hiddenPhotoUrls` in
 * `/api/proposals` fails closed for that recipe — every sample dropped —
 * rather than miss a hidden row.
 */
export const MODERATION_LIST_LIMIT = 200;

/** A row as `MODERATION_PHOTO_COLUMNS` reads it. */
export type ModerationRow = {
  id: string;
  image_url: string;
  author_name: string | null;
  approved: boolean;
  created_at: string;
};

/** What the moderation screen is sent: a credit name, never an address. */
export type ModeratedPhoto = {
  id: string;
  imageUrl: string;
  authorName: string | null;
  approved: boolean;
  createdAt: string;
};

/**
 * Picks the five fields by name. A row that arrived with more — a column list
 * widened by mistake, `submitted_by`, an address — still leaves with five.
 */
export function toModeratedPhoto(row: ModerationRow): ModeratedPhoto {
  return {
    id: String(row.id),
    imageUrl: String(row.image_url),
    authorName: typeof row.author_name === 'string' ? row.author_name : null,
    approved: row.approved === true,
    createdAt: String(row.created_at),
  };
}

/**
 * Proposals with every hidden gallery photo taken off them as a sample.
 *
 * A proposal's sample also joins the gallery, so one URL sits in two tables:
 * `community_photos.image_url`, which moderation switches, and
 * `recipe_proposals.sample_image_url`, which it does not. Hiding a photo must
 * take it off the proposal card too, and filing a fresh proposal with a hidden
 * URL must not put it back — so the proposals read matches by URL, whatever
 * row the URL arrived on, and "Show again" restores it with no data change.
 *
 * `hidden` is the slug's hidden URLs, or `null` when they could not be read.
 * Unknown fails closed: every sample is dropped, because serving one an editor
 * hid is the failure this exists to prevent. Only a URL actually hidden is
 * matched, never "absent from the visible gallery": a sample that never joined
 * it (the cap was reached, or its insert failed) was never moderated.
 */
export function withoutHiddenSamples<T extends { sampleImageUrl: string | null }>(
  items: readonly T[],
  hidden: ReadonlySet<string> | null,
): T[] {
  return items.map((item) =>
    item.sampleImageUrl !== null && (hidden === null || hidden.has(item.sampleImageUrl))
      ? { ...item, sampleImageUrl: null }
      : item,
  );
}

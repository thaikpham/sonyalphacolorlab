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
 * Client-safe: the screen imports the type, the route the schema and mapper.
 */

/** The PATCH body: which photo, and whether readers see it. Nothing else. */
export const moderationPatchSchema = z.strictObject({
  id: z.uuid(),
  approved: z.boolean(),
});

export type ModerationPatch = z.infer<typeof moderationPatchSchema>;

/**
 * Every row of one recipe, hidden ones included — bounded, as every read is.
 * The submission routes cap a recipe at `MAX_PHOTOS_PER_RECIPE` counting hidden
 * rows too, so this ceiling is reached only by rows written outside the app.
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

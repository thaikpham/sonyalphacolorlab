/**
 * Where a recipe photograph lives, and why it is not where article media lives.
 *
 * The content baseline says it outright: "Recipe photography is not here and
 * never will be: it is served from `public/recipes`, which is what ended the
 * 1.27 GB/day of cached egress." That is not a preference. On 2026-09-11
 * Storage served recipe photographs at their stored resolution to a grid that
 * every visitor loads, and the resulting egress restricted the whole project —
 * Storage, Auth and PostgREST answering 402 together.
 *
 * So this pipeline splits the two jobs that were previously one:
 *
 * - **Storage is the INTAKE.** An upload is processed here and written to a
 *   PRIVATE bucket. No reader ever fetches from it; the admin sees its own
 *   uploads through short-lived signed URLs, the same arrangement `lab-drafts`
 *   has for unpublished articles.
 * - **`public/recipes` is the ORIGIN.** `npm run vendor:images` pulls the
 *   variants down, writes them into `public/`, and rewrites
 *   `data/images.seed.json`. A photograph goes live at the next deploy, on the
 *   same static CDN as the fonts, with no egress quota in front of it.
 *
 * The consequence is deliberate and the editor states it: an uploaded
 * photograph is visible to the editor immediately and to readers at the next
 * deploy. That is the price of the incident fix, and it is cheaper than the
 * incident.
 *
 * Deliberately free of `server-only`: the admin screen needs the widths and the
 * path shape to render a preview, and the same rules must hold on both sides.
 */

/**
 * The three rungs, and there is no fourth.
 *
 * The same three the vendored photographs already use and the same three
 * `catalogue-loader.ts` rewrites between — the grid card, the detail column and
 * the full-bleed case. A fourth would be bytes nobody requests, and would make
 * the loader's suffix rewrite ambiguous.
 */
export const RECIPE_IMAGE_WIDTHS = [320, 640, 1024] as const;

export type RecipeImageWidth = (typeof RECIPE_IMAGE_WIDTHS)[number];

/** The private intake bucket on the content project. Never public. */
export const RECIPE_UPLOAD_BUCKET = 'recipe-uploads';

/** How long an admin preview URL lives. Long enough to edit, short enough to leak harmlessly. */
export const PREVIEW_TTL_SECONDS = 60 * 30;

/**
 * `SCL-CL-001/00-1024.webp` — recipe, two-digit slot, width.
 *
 * The slot is the position the photograph was uploaded into, not its display
 * order: `sort` in `recipe_images` decides what a reader sees, and reordering
 * must not rename a file that is already vendored and cached at the CDN.
 */
export function recipeImagePath(recipeId: string, slot: number, width: RecipeImageWidth): string {
  return `${recipeId}/${String(slot).padStart(2, '0')}-${width}.webp`;
}

/** The stem shared by a photograph's three widths, e.g. `SCL-CL-001/00`. */
export function recipeImageStem(storagePath: string): string {
  return storagePath.replace(/-(\d+)\.webp$/, '');
}

/**
 * A stored path becomes the URL `public/` serves.
 *
 * The one mapping, used by the reader and by the admin's "already live" check,
 * so the two cannot disagree about whether a photograph is on the site.
 */
export function publicRecipeImageUrl(storagePath: string): string {
  return `/recipes/${storagePath}`;
}

/**
 * The widths must round-trip through the loader's suffix rewrite.
 *
 * `catalogue-loader.ts` matches `/recipes/<stem>-<width>.webp` and swaps the
 * width for the rung it wants. A path this module produces that the loader
 * cannot parse would render at whatever width happened to be requested first.
 */
export const RECIPE_IMAGE_PATH_RE = /^[A-Za-z0-9-]+\/\d{2}-(320|640|1024)\.webp$/;

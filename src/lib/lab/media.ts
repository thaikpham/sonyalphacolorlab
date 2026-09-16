import {
  DEFAULT_RUNG,
  PUBLIC_BUCKET,
  assetVariantPath,
  type LabAssetWidth,
} from './assets';

/**
 * Turning an asset UUID into something an `<img>` can fetch.
 *
 * This is the only place in the application that knows an article picture lives
 * in Supabase Storage. That is the payoff of storing UUIDs in the block: moving
 * projects changes this file, not every article body.
 *
 * It replaced `bypassOptimizer()`, which existed to answer two questions that
 * no longer arise. One was "is this an animated GIF the optimizer would freeze
 * into a still?" — animation is refused at upload now, by a CHECK constraint
 * rather than a flag. The other was "is this a local development upload with no
 * size variants to choose between?" — every asset has exactly three variants
 * now, offline included, because the offline branch runs the same processor.
 *
 * Every URL here is immutable. The path contains a UUID that is generated once
 * and never reused, so the object at it never changes, so a one-year cache
 * lifetime is honest rather than optimistic.
 */

/** The prefix the offline upload branch writes under, inside `public/`. */
const LOCAL_PREFIX = '/lab';

/**
 * The public origin of the content project, or null offline.
 *
 * Read as a literal `process.env.X` rather than through a helper: this module
 * is imported by client components, and Next only inlines `NEXT_PUBLIC_*` into
 * the browser bundle when it can see the property access statically.
 */
function contentStorageOrigin(): string | null {
  const raw = process.env.NEXT_PUBLIC_CONTENT_SUPABASE_URL;
  return raw && raw.trim() ? raw.trim().replace(/\/+$/, '') : null;
}

/**
 * Where one variant of one asset is served from.
 *
 * Returns `undefined` rather than a guess when there is no content project
 * configured and no local copy to fall back on — a renderer that gets
 * `undefined` renders nothing, which is the correct outcome for a picture that
 * does not exist anywhere.
 */
export function assetUrl(
  articleId: string,
  assetId: string,
  width: LabAssetWidth = DEFAULT_RUNG,
): string | undefined {
  const path = assetVariantPath(articleId, assetId, width);
  const origin = contentStorageOrigin();
  if (origin) return `${origin}/storage/v1/object/public/${PUBLIC_BUCKET}/${path}`;

  /* Offline development. The same three rungs, written into `public/lab/` by
     the upload route's dev branch, so the article renders identically with no
     Supabase at all and no special case in any component. */
  return `${LOCAL_PREFIX}/${path}`;
}

/*
 * There is deliberately no `srcSet` helper here.
 *
 * `next/image` refuses a `srcSet` prop, and rightly: it builds one itself from
 * `sizes` by calling the configured loader once per candidate width. This
 * project has a custom loader, so the rung selection belongs there —
 * `catalogue-loader.ts` rewrites the width segment of one of these URLs to the
 * nearest of the three that exist. One place decides which files exist; one
 * place decides which of them a given width gets.
 */

/**
 * What an article block stores when it refers to a picture.
 *
 * A UUID, and never a URL. That is the whole design decision, and the migration
 * this work is part of is the argument for it: a stored
 * `https://nqeedlgzaewccqztqvik.supabase.co/storage/v1/object/public/lab/…`
 * bakes a project reference into an article's body, so moving projects would
 * have meant rewriting every embedded image in every article — a data migration
 * caused entirely by a rendering convenience.
 *
 * With a UUID, the article says *which* picture and the server decides where it
 * currently lives. Publishing copies bytes between buckets; unpublishing
 * removes the public copy; a future third project would change one function.
 * The article body never notices.
 *
 * Deliberately free of `server-only`: `parse.ts` runs on both sides of the
 * boundary and the editor validates the same shape the API does.
 */

/**
 * The three rungs, and there is no fourth.
 *
 * They are the widths the article layout actually renders at — the feed card,
 * the in-column figure, and the full-bleed comparison — so a fourth would be
 * bytes nobody requests. The custom loader picks one of these directly, which
 * is what keeps article media off the Vercel image optimizer and out of the
 * Supabase transformation quota.
 */
export const LAB_ASSET_WIDTHS = [320, 640, 1024] as const;

export type LabAssetWidth = (typeof LAB_ASSET_WIDTHS)[number];

/** The private bucket. Raw uploads and the variants of unpublished articles. */
export const DRAFT_BUCKET = 'lab-drafts';

/** The public bucket. Only processed variants of *published* articles. */
export const PUBLIC_BUCKET = 'lab';

/**
 * The canonical 8-4-4-4-12 form, with a version and variant nibble.
 *
 * Strict on purpose. These strings become Storage path segments, so a loose
 * pattern is a path-traversal surface — and they are looked up as an owner key,
 * so accepting a near-miss turns a typo into "no such asset" rather than a
 * refusal at the boundary.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function isAssetId(raw: unknown): raw is string {
  return typeof raw === 'string' && UUID.test(raw.trim().toLowerCase());
}

/** Narrows an untrusted field to an asset id, or drops it. */
export function parseAssetId(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const value = raw.trim().toLowerCase();
  return UUID.test(value) ? value : undefined;
}

/**
 * Where one variant lives, in either bucket.
 *
 * The same path in both, which is what makes publishing a copy rather than a
 * move-and-rewrite: the public object and the private one differ only in which
 * bucket they are in, so the row does not change and nothing has to be
 * recomputed to unpublish.
 *
 * The article id is in the path so a human reading a bucket listing can tell
 * what an object belongs to; the asset UUID is what makes it unique.
 */
export function assetVariantPath(
  articleId: string,
  assetId: string,
  width: LabAssetWidth,
): string {
  return `${articleId}/${assetId}/${width}.webp`;
}

export function assetVariantPaths(articleId: string, assetId: string): string[] {
  return LAB_ASSET_WIDTHS.map((w) => assetVariantPath(articleId, assetId, w));
}

/** The rung a `<img>` gets when nothing has asked for a size. */
export const DEFAULT_RUNG: LabAssetWidth = 1024;

/**
 * Every asset an article's body refers to, deduplicated.
 *
 * This is the set the publish step copies and the delete step removes, so a
 * miss in either direction is a real cost: a missed reference publishes an
 * article with a broken image, and a phantom one copies bytes nobody will ever
 * fetch and then bills to store them.
 *
 * It reads the blocks rather than the asset table on purpose — the article body
 * is the authority on what the article shows. An asset row that nothing
 * references is precisely what `orphaned` means.
 */
export function referencedAssetIds(blocks: readonly unknown[]): string[] {
  const found = new Set<string>();
  for (const block of blocks) {
    if (typeof block !== 'object' || block === null) continue;
    const b = block as Record<string, unknown>;
    for (const key of ['assetId', 'beforeAssetId', 'afterAssetId']) {
      const id = parseAssetId(b[key]);
      if (id) found.add(id);
    }
  }
  return [...found];
}

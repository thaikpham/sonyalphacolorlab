'use client';

/**
 * The catalogue's image loader, in place of Vercel's optimizer.
 *
 * `/_next/image` on production answered `402
 * OPTIMIZED_IMAGE_REQUEST_PAYMENT_REQUIRED` — the plan's Image Optimization
 * quota was spent — so every wiki photo rendered broken while the originals
 * were still 200 at the CDN. Nothing in the markup was wrong: `sizes` was
 * already set on all 94 images and every host was already named in
 * `remotePatterns`. Only the optimizer in front of them had stopped answering.
 *
 * B&H publishes each catalogue photo at several sizes under parallel paths
 * keyed by the **same numeric id**, so the responsive behaviour the layouts ask
 * for survives with no optimizer and no bill:
 *
 *     images500x500     ~59KB   what every surface here actually renders
 *     images1000x1000  ~201KB   the wide and detail cases
 *
 * The filename carries across unchanged — its *shape* does not matter, only the
 * directory does. Sampled against live B&H: 25/25 bare numeric ids, 10/10
 * `<timestamp>_<id>` names and 20/20 slug names (`sony_sel2470z_…_1008126.jpg`)
 * all resolve under `images500x500`.
 *
 * Two things this deliberately does NOT do:
 *
 * - **It only rewrites directories proven to carry both variants.** `articles`,
 *   `manufacturers`, `categoryImages` and `PLCC` publish nothing under the size
 *   paths, and `multiple_images` is worse than absent — it is *inconsistent*
 *   (`1634137757000_IMG_1621830.jpg` exists at 500 but 404s at 1000), so a rule
 *   that looked right on one sample would have turned a working photo into a
 *   404 at the other. The exact failure this file exists to fix. All of them
 *   pass through at their published size.
 * - **It does not touch Sony's own hosts or the local `/logo.png` family.**
 *   They are returned verbatim: none of them publishes a size-variant path this
 *   loader could target, and the local files are already small.
 *
 * ---
 *
 * **No image on this site is transformed on demand any more.**
 *
 * Recipe photographs used to pass through verbatim, which meant no resizing
 * ever happened to them: a 210px grid card downloaded the full original.
 * Measured against 24h of Supabase edge logs that was **1.27GB of CDN egress a
 * day**, 90% of it grid thumbnails — roughly 38GB a month against a 5GB quota,
 * which is what restricted the project and took Storage, Auth and PostgREST
 * down together with `402 exceed_cached_egress_quota`.
 *
 * They were briefly routed back through `/_next/image`, which traded a Supabase
 * quota for a Vercel one — and Vercel's had already run out once. They are
 * vendored into `public/recipes` at three widths now, and article media is
 * written to Storage at the same three widths at upload. Both branches below do
 * the same thing: pick the rung that already exists by rewriting the path. No
 * optimizer, no transformation bill, no per-request work anywhere.
 */

/** Directories confirmed to serve the same filename at both variant sizes. */
const RESIZABLE_VARIANTS = new Set([
  'fb',
  'items',
  'largeimages',
  'images500x500',
  'images1000x1000',
  'images2500x2500',
]);

/**
 * The widest layout that renders a catalogue photo is a grid card. Anything at
 * or under this asks B&H for the 500px original; above it, the 1000px one.
 * Both are real files, so there is no upscaling either way.
 */
const SMALL_VARIANT_MAX_WIDTH = 500;

const BH_HOST = 'static.bhphoto.com';
const BH_PATH = /^\/images\/([^/]+)\/([^/]+)$/;

/**
 * An article asset, at whichever of its three rungs fits.
 *
 * The path shape is fixed by `assets.ts` and is the same in both places it can
 * appear: `<article-id>/<asset-uuid>/<width>.webp`, either under the content
 * project's public `lab` bucket or under `/lab/` in `public/` offline. Only the
 * width segment is rewritten, so this can never point at a different asset — it
 * is a rung selector, not a URL builder.
 *
 * Matched on the path alone, deliberately. A host check would have to know
 * which project is configured, and the shape `<uuid>/<320|640|1024>.webp` under
 * a `lab` segment is already specific enough that nothing else can collide with
 * it. Anything that does not match falls through untouched.
 */
const LAB_ASSET_RUNG =
  /^(.*\/lab\/[^/]+\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/)(320|640|1024)\.webp$/;

const LAB_WIDTHS = [320, 640, 1024] as const;

interface LoaderArgs {
  src: string;
  width: number;
  quality?: number;
}

/**
 * The vendored recipe photographs, and the rungs they exist at on disk.
 *
 * Must agree with `WIDTHS` in `scripts/vendor-recipe-images.ts`, which writes
 * them. Picking between real files by rewriting the suffix means no optimizer
 * is involved at all — not Vercel's, not Supabase's. It is the same move the
 * B&H branch below makes against B&H's published size paths; the difference is
 * that here we publish the sizes ourselves.
 */
const LOCAL_RECIPE_RUNG = /^\/recipes\/(.+)-(\d+)\.webp$/;
const LOCAL_WIDTHS = [320, 640, 1024] as const;

export default function catalogueImageLoader({ src, width }: LoaderArgs): string {
  const asset = LAB_ASSET_RUNG.exec(src);
  if (asset) {
    const rung = LAB_WIDTHS.find((w) => width <= w) ?? LAB_WIDTHS[LAB_WIDTHS.length - 1];
    return `${asset[1]}${rung}.webp`;
  }

  const local = LOCAL_RECIPE_RUNG.exec(src);
  if (local) {
    const rung = LOCAL_WIDTHS.find((w) => width <= w) ?? LOCAL_WIDTHS[LOCAL_WIDTHS.length - 1];
    return `/recipes/${local[1]}-${rung}.webp`;
  }

  // Relative sources (`/logo.png`) are not URLs and must not reach `new URL`.
  if (!src.startsWith('http://') && !src.startsWith('https://')) return src;

  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return src;
  }

  if (url.hostname !== BH_HOST) return src;

  const match = BH_PATH.exec(url.pathname);
  if (!match) return src;

  const [, variant, filename] = match;
  if (!RESIZABLE_VARIANTS.has(variant)) return src;

  const target = width <= SMALL_VARIANT_MAX_WIDTH ? 'images500x500' : 'images1000x1000';
  url.pathname = `/images/${target}/${filename}`;
  return url.toString();
}

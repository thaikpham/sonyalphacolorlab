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
 * - **It does not touch a non-B&H src.** Sony's own hosts, Supabase Storage and
 *   the local `/logo.png` family are returned verbatim. They lose optimization
 *   they were not receiving anyway while the quota was spent, and none of them
 *   publishes a size-variant path this loader could target.
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

interface LoaderArgs {
  src: string;
  width: number;
  quality?: number;
}

export default function catalogueImageLoader({ src, width }: LoaderArgs): string {
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

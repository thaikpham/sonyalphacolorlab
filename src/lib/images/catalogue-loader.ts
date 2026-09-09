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
 * **Supabase Storage is the exception, and it is why this file was revisited.**
 *
 * Recipe photographs used to pass through verbatim too, which meant no resizing
 * ever happened to them: a 210px grid card downloaded the full original. The
 * catalogue averages 155KB an image and one of them is a 1.87MB PNG. Measured
 * against 24h of Supabase edge logs, that was **1.27GB of CDN egress a day**,
 * 90% of it grid thumbnails — roughly 38GB a month against a 5GB quota, which
 * is what restricted the project and took Storage, Auth and PostgREST down
 * together with `402 exceed_cached_egress_quota`.
 *
 * So these go back through `/_next/image`. That is the same optimizer this file
 * was written to escape, and the difference is what reaches it:
 *
 * - Only Storage photographs, never the B&H catalogue. B&H keeps the direct-CDN
 *   path above, so the 94 wiki photos that 402'd in August do not return.
 * - The requested width is snapped to **two** rungs, mirroring what B&H
 *   publishes. Next would otherwise ask across its whole ladder, and the
 *   optimizer is billed per distinct transformation, not per request. 185
 *   objects x 2 rungs bounds the whole catalogue at ~370 transformations.
 * - `minimumCacheTTL` in `next.config.ts` is a year, so the optimizer fetches
 *   each original from Storage once and serves every reader from its own cache.
 *   Supabase egress for images stops scaling with traffic at all.
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
 * The project's own Storage host, or undefined when Supabase is not configured
 * — the app still runs off the seed files then, and there are no Storage URLs
 * for this branch to match.
 *
 * Read through a function rather than captured at module scope. Two reasons,
 * one of them a real hazard: a malformed env value would make `new URL()` throw
 * during module evaluation, which in a bundled client chunk takes down far more
 * than image loading. Here it degrades to "no Storage host" instead. The memo
 * keeps the parse off the hot path; in the browser the env read is a build-time
 * literal either way.
 */
let hostMemo: { raw: string | undefined; host: string | undefined } | null = null;

function storageHost(): string | undefined {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!hostMemo || hostMemo.raw !== raw) {
    let host: string | undefined;
    try {
      host = raw ? new URL(raw).hostname : undefined;
    } catch {
      host = undefined;
    }
    hostMemo = { raw, host };
  }
  return hostMemo.host;
}

/** Only what `remotePatterns` in `next.config.ts` already allows through. */
const STORAGE_PATH_PREFIX = '/storage/v1/object/public/';

/**
 * The rungs Storage photographs are optimized at.
 *
 * Every one is a member of `imageSizes`/`deviceSizes` — the optimizer rejects a
 * width it was not configured for — and the shortness of the list is the whole
 * point: the count of distinct transformations, not the count of requests, is
 * what the optimizer bills and what ran out in August. Three rungs puts the
 * whole 185-object catalogue at ~555 transformations.
 *
 * 256 exists for the lightbox furniture. Its filmstrip thumbnails are 48px and
 * its prev/next previews 128–176px; serving those from the 640 rung was a 10x
 * overdraw on the one surface that renders sixteen images at once.
 */
const STORAGE_WIDTHS = [256, 640, 1200] as const;

/** Next's own default, restated because this loader must supply one. */
const DEFAULT_QUALITY = 75;

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

export default function catalogueImageLoader({ src, width, quality }: LoaderArgs): string {
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

  /* Recipe photographs, back through the optimizer. The path is checked as well
     as the host so this can only ever name a public Storage object — the same
     closed shape `remotePatterns` enforces on the other side, because a loader
     that will hand `/_next/image` any path on the host turns the optimizer into
     a proxy for whatever else that host serves. */
  const storage = storageHost();
  if (storage && url.hostname === storage && url.pathname.startsWith(STORAGE_PATH_PREFIX)) {
    const rung = STORAGE_WIDTHS.find((w) => width <= w) ?? STORAGE_WIDTHS[STORAGE_WIDTHS.length - 1];
    const params = new URLSearchParams({
      url: src,
      w: String(rung),
      q: String(quality ?? DEFAULT_QUALITY),
    });
    return `/_next/image?${params}`;
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

import 'server-only';
import sharp, { type Metadata } from 'sharp';

import { LAB_ASSET_WIDTHS, type LabAssetWidth } from './assets';

/**
 * Every byte that reaches a reader, re-encoded here first.
 *
 * The old upload route stored the original file. That is three separate
 * problems wearing one coat:
 *
 * - **Egress.** A 12 MB phone screenshot was served at 12 MB to every reader of
 *   that article. The project this application runs on is currently restricted
 *   for exactly this reason, on recipe photography rather than article media —
 *   the same mistake, one directory over.
 * - **Metadata.** A JPEG straight off a phone carries GPS coordinates, a device
 *   serial and a capture time. Publishing it publishes those. Sharp drops all
 *   of it unless asked to keep it, so the fix is to never call
 *   `withMetadata()` — an omission, which is why it is written down here.
 * - **Decompression.** A 200 KB PNG can decode to gigabytes. The compressed
 *   size check everyone writes is the wrong check; the pixel count is the one
 *   that matters, and `limitInputPixels` enforces it inside the decoder rather
 *   than after it.
 *
 * GIF is refused. It bypassed the optimizer entirely and was served whole, so a
 * 40 MB screen recording was one drag-and-drop away. Re-enabling animation
 * needs a measured format and size policy of its own — a constraint in the
 * schema says so, so it cannot come back as a forgotten default.
 *
 * SVG is refused because it is script-capable and this bucket is embedded by
 * this app's own pages.
 */

/** 8 MiB of *compressed* input. Checked before the decoder is handed anything. */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

/** Per-side ceiling, matching the CHECK constraint on `lab_assets`. */
export const MAX_DIMENSION = 12_000;

/** Total pixels, which is what actually predicts memory. 40MP ≈ 160 MB decoded. */
export const MAX_PIXELS = 40_000_000;

/** One number for the whole project, so two uploads never differ in quality. */
export const WEBP_QUALITY = 78;

export type ProcessedLabImage = {
  /** The decoded source dimensions, after rotation. */
  width: number;
  height: number;
  /** Total bytes across all variants — what the bucket will actually hold. */
  byteSize: number;
  variants: readonly { rung: LabAssetWidth; bytes: Buffer }[];
};

export type ProcessFailure = 'tooLarge' | 'dimensionsTooLarge' | 'unsupportedType';

export type ProcessResult =
  | { ok: true; image: ProcessedLabImage }
  | { ok: false; error: ProcessFailure };

/** The three formats that survive re-encoding to WebP with nothing lost. */
const ACCEPTED = new Set(['jpeg', 'jpg', 'png', 'webp']);

export async function processLabImage(input: Uint8Array): Promise<ProcessResult> {
  if (input.byteLength > MAX_UPLOAD_BYTES) return { ok: false, error: 'tooLarge' };

  const source = Buffer.from(input);

  let meta: Metadata;
  try {
    /* `limitInputPixels: false` here and only here. Reading metadata parses the
       header, it does not rasterise — so the guard would fire before we had the
       dimensions to explain *why* we refused, and a decompression bomb would
       come back as "unsupported format". The bounds are enforced immediately
       below, and the decode calls further down keep the real limit. */
    meta = await sharp(source, { limitInputPixels: false }).metadata();
  } catch {
    /* Corrupt bytes, a truncated upload, or a format Sharp will not open. The
       raw Sharp message names file offsets and is no use to an editor. */
    return { ok: false, error: 'unsupportedType' };
  }

  if (!meta.format || !ACCEPTED.has(meta.format)) return { ok: false, error: 'unsupportedType' };
  /* An animated WebP is a WebP by format and a video by behaviour. It is
     refused for the same reason GIF is. */
  if ((meta.pages ?? 1) > 1) return { ok: false, error: 'unsupportedType' };

  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (width <= 0 || height <= 0) return { ok: false, error: 'unsupportedType' };
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    return { ok: false, error: 'dimensionsTooLarge' };
  }
  if (width * height > MAX_PIXELS) return { ok: false, error: 'dimensionsTooLarge' };

  const variants: { rung: LabAssetWidth; bytes: Buffer }[] = [];
  try {
    for (const rung of LAB_ASSET_WIDTHS) {
      const bytes = await sharp(source, { limitInputPixels: MAX_PIXELS })
        /* Applies the EXIF orientation and then discards it. Without this a
           portrait photograph from a phone renders on its side, because the
           tag that said otherwise is one of the things being stripped. */
        .rotate()
        .resize({ width: rung, fit: 'inside', withoutEnlargement: true })
        /* No `withMetadata()`. That call is what would carry GPS coordinates
           and a device serial into a public bucket. */
        .webp({ quality: WEBP_QUALITY })
        .toBuffer();
      variants.push({ rung, bytes });
    }
  } catch {
    return { ok: false, error: 'unsupportedType' };
  }

  return {
    ok: true,
    image: {
      /* Reported after rotation, so they describe the pixels a reader sees
         rather than the ones on disk. */
      width: meta.autoOrient?.width ?? width,
      height: meta.autoOrient?.height ?? height,
      byteSize: variants.reduce((total, v) => total + v.bytes.byteLength, 0),
      variants,
    },
  };
}

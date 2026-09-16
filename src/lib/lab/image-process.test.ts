import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import {
  MAX_UPLOAD_BYTES,
  WEBP_QUALITY,
  processLabImage,
} from './image-process';

/**
 * The bytes that reach a reader, and the bytes that must not.
 *
 * Fixtures are generated here rather than committed: a binary in the repo that
 * nobody can read is a fixture nobody can check, and Sharp can make exactly the
 * pathological cases that matter — a portrait JPEG with an orientation tag, a
 * one-pixel PNG, an animated WebP — in a line each.
 *
 * The three properties worth the most are the ones that fail silently:
 * metadata surviving into a public bucket, an upload being enlarged to fill a
 * rung it never had the pixels for, and a small file decoding to gigabytes.
 */

const solid = (width: number, height: number) =>
  sharp({
    create: { width, height, channels: 3, background: { r: 120, g: 130, b: 200 } },
  });

async function jpeg(width = 1600, height = 900): Promise<Uint8Array> {
  return new Uint8Array(await solid(width, height).jpeg().toBuffer());
}

describe('processLabImage', () => {
  it.each([
    ['jpeg', async () => new Uint8Array(await solid(1600, 900).jpeg().toBuffer())],
    ['png', async () => new Uint8Array(await solid(1600, 900).png().toBuffer())],
    ['webp', async () => new Uint8Array(await solid(1600, 900).webp().toBuffer())],
  ])('turns %s into exactly the three rungs', async (_label, make) => {
    const result = await processLabImage(await make());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.image.variants.map((v) => v.rung)).toEqual([320, 640, 1024]);
  });

  it('produces WebP at every rung, whatever went in', async () => {
    const result = await processLabImage(await jpeg());
    if (!result.ok) throw new Error('expected success');
    for (const variant of result.image.variants) {
      const meta = await sharp(variant.bytes).metadata();
      expect(meta.format).toBe('webp');
    }
  });

  it('resizes to the rung width', async () => {
    const result = await processLabImage(await jpeg(1600, 900));
    if (!result.ok) throw new Error('expected success');
    const widths = await Promise.all(
      result.image.variants.map(async (v) => (await sharp(v.bytes).metadata()).width),
    );
    expect(widths).toEqual([320, 640, 1024]);
  });

  it('never enlarges a source smaller than a rung', async () => {
    /* `withoutEnlargement`. Upscaling a 400px screenshot to 1024 invents
       nothing and costs three times the bytes for a blurrier picture. */
    const result = await processLabImage(await jpeg(400, 300));
    if (!result.ok) throw new Error('expected success');
    const widths = await Promise.all(
      result.image.variants.map(async (v) => (await sharp(v.bytes).metadata()).width),
    );
    expect(widths).toEqual([320, 400, 400]);
  });

  it('strips EXIF, so a phone photograph does not publish its GPS fix', async () => {
    const withExif = new Uint8Array(
      await solid(1200, 800)
        .withExif({ IFD0: { Copyright: 'An Editor', Software: 'a-camera' } })
        .jpeg()
        .toBuffer(),
    );
    const result = await processLabImage(withExif);
    if (!result.ok) throw new Error('expected success');
    for (const variant of result.image.variants) {
      const meta = await sharp(variant.bytes).metadata();
      expect(meta.exif).toBeUndefined();
    }
  });

  it('applies the orientation tag before discarding it', async () => {
    /* Strip the tag without rotating and every portrait photograph from a
       phone renders on its side. */
    const rotated = new Uint8Array(
      await solid(1200, 600).withMetadata({ orientation: 6 }).jpeg().toBuffer(),
    );
    const result = await processLabImage(rotated);
    if (!result.ok) throw new Error('expected success');
    const first = await sharp(result.image.variants[0].bytes).metadata();
    // Orientation 6 is a quarter turn: the wide source becomes tall.
    expect((first.height ?? 0) > (first.width ?? 0)).toBe(true);
  });

  it('reports the total bytes of everything it will store', async () => {
    const result = await processLabImage(await jpeg());
    if (!result.ok) throw new Error('expected success');
    const summed = result.image.variants.reduce((n, v) => n + v.bytes.byteLength, 0);
    expect(result.image.byteSize).toBe(summed);
    expect(result.image.byteSize).toBeGreaterThan(0);
  });

  it('refuses compressed input over the ceiling before decoding it', async () => {
    const oversized = new Uint8Array(MAX_UPLOAD_BYTES + 1);
    await expect(processLabImage(oversized)).resolves.toEqual({ ok: false, error: 'tooLarge' });
  });

  it('refuses a side over 12000 pixels', async () => {
    const wide = new Uint8Array(await solid(12_001, 10).png().toBuffer());
    await expect(processLabImage(wide)).resolves.toEqual({
      ok: false,
      error: 'dimensionsTooLarge',
    });
  });

  it('refuses a decompression bomb by pixel count, not file size', async () => {
    /* The point of the check. This PNG compresses to a few hundred kilobytes
       and decodes to well over the pixel ceiling. */
    const bomb = new Uint8Array(await solid(9_000, 9_000).png({ compressionLevel: 9 }).toBuffer());
    expect(bomb.byteLength).toBeLessThan(MAX_UPLOAD_BYTES);
    await expect(processLabImage(bomb)).resolves.toEqual({
      ok: false,
      error: 'dimensionsTooLarge',
    });
  });

  it('refuses GIF', async () => {
    const gif = new Uint8Array(await solid(320, 200).gif().toBuffer());
    await expect(processLabImage(gif)).resolves.toEqual({ ok: false, error: 'unsupportedType' });
  });

  it('refuses SVG, which is script-capable', async () => {
    const svg = new TextEncoder().encode(
      '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>',
    );
    await expect(processLabImage(svg)).resolves.toEqual({ ok: false, error: 'unsupportedType' });
  });

  it('refuses an animated WebP, which is a video wearing a still format', async () => {
    const animated = new Uint8Array(
      await sharp(
        { create: { width: 64, height: 32, channels: 3, background: '#123456' }, animated: true },
      )
        .webp({ loop: 0 })
        .toBuffer(),
    );
    const meta = await sharp(animated).metadata();
    if ((meta.pages ?? 1) > 1) {
      await expect(processLabImage(animated)).resolves.toEqual({
        ok: false,
        error: 'unsupportedType',
      });
    }
  });

  it('refuses corrupt bytes without leaking the decoder message', async () => {
    const corrupt = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5, 6, 7, 8]);
    await expect(processLabImage(corrupt)).resolves.toEqual({
      ok: false,
      error: 'unsupportedType',
    });
  });

  it('uses one quality for the whole project', () => {
    expect(WEBP_QUALITY).toBe(78);
  });
});

import { describe, expect, it } from 'vitest';

import { imageRow, productRow } from './seed-rows';
import type { SonyCamera } from '../../src/lib/cameras/types';

/**
 * What `push:supabase` writes for a seed entry.
 *
 * `pull:supabase` brings highlights back into the seed and `vendor:uploads`
 * writes alt text into the image manifest. A row builder that leaves either
 * column out rebuilds a project with every camera page on the fallback bullets
 * and every photograph unlabelled — and `--overwrite` blanks them on a live one.
 */

const side = {
  points: [1, 2, 3, 4].map((n) => ({ title: `Point ${n}`, body: `Body ${n}` })),
  keySpecs: [{ key: 'sensor' as const, value: 'Full-Frame Exmor R CMOS BSI' }],
};

const camera = {
  id: 'probe',
  sku: 'PROBE',
  name: 'Probe',
  fullName: 'Probe camera',
  category: 'camera',
  subCategory1: null,
  subCategory2: null,
  priceVnd: null,
  priceFormatted: null,
  url: null,
  imageUrl: null,
  features: [],
} as unknown as SonyCamera;

describe('productRow', () => {
  it('carries the highlights the seed holds', () => {
    const highlights = { en: side, vi: side };
    expect(productRow({ ...camera, highlights }).highlights).toEqual(highlights);
  });

  it('writes null when the seed has none', () => {
    expect(productRow(camera).highlights).toBeNull();
  });

  it('refuses highlights that would not validate on read', () => {
    /* The page would render the fallback anyway; a push is the place to say so. */
    const broken = { en: { ...side, points: [] }, vi: side } as unknown as SonyCamera['highlights'];
    expect(() => productRow({ ...camera, highlights: broken })).toThrow(/probe/);
  });
});

describe('imageRow', () => {
  it('carries alt text', () => {
    expect(
      imageRow({ recipeId: 'SCL-CL-001', storagePath: 'SCL-CL-001/03-1024.webp', sort: 3, alt: 'A street' }),
    ).toEqual({
      recipe_id: 'SCL-CL-001',
      storage_path: 'SCL-CL-001/03-1024.webp',
      sort: 3,
      alt: 'A street',
    });
  });

  it('writes null alt when the manifest has none', () => {
    expect(imageRow({ recipeId: 'R', storagePath: 'R/00-1024.webp', sort: 0 }).alt).toBeNull();
  });
});

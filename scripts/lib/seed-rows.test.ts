import { describe, expect, it } from 'vitest';

import { productRow } from './seed-rows';
import type { SonyCamera } from '../../src/lib/cameras/types';

/**
 * What `push:supabase` writes for a seed entry.
 *
 * `pull:supabase` brings highlights back into the seed. A row builder that
 * leaves the column out rebuilds a project with every camera page on the
 * fallback bullets — and `--overwrite` blanks them on a live one.
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

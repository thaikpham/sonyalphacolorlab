import { describe, expect, it } from 'vitest';
import { getSonyAudio, getSonyAudioById } from './data';
import { SPEC_ROWS } from '@/lib/cameras/types';

/**
 * What this pins is *provenance*, not prose.
 *
 * The audio catalogue is transcribed from two FY26 comparison sheets that
 * publish a price and a spec table and nothing else — no SKU, no product URL,
 * no image asset. The failure this file exists to catch is the tempting one:
 * filling those in later from a plausible-looking pattern (a B&H URL built
 * from a guessed SKU renders a broken image and reads as sourced). So every
 * blank must stay blank *and* stay named in `specsMissing`.
 */

const products = await getSonyAudio();

describe('sony audio catalogue', () => {
  it('carries all 25 products from the FY26 sheets', () => {
    expect(products).toHaveLength(25);
  });

  it('has unique ids', () => {
    const ids = products.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('splits into the five groups the sheets publish', () => {
    const groups = products.reduce<Record<string, number>>((acc, p) => {
      acc[`${p.subCategory1}/${p.subCategory2}`] = (acc[`${p.subCategory1}/${p.subCategory2}`] ?? 0) + 1;
      return acc;
    }, {});
    expect(groups).toEqual({
      'Tai nghe/Choàng đầu': 5,
      'Tai nghe/Nhét tai': 5,
      'Tai nghe/Gaming': 6,
      'Loa/Di động': 5,
      'Loa/Karaoke': 4,
    });
  });

  it('lists ULT FIELD 7 once, under portable speakers', () => {
    /* It is printed on both sheets, at two different prices. One product, one
       row, at the price the portable-speaker sheet gives; the conflict is
       recorded in `specsSource` rather than averaged away. */
    const f7 = products.filter((p) => p.name === 'ULT FIELD 7');
    expect(f7).toHaveLength(1);
    expect(f7[0].subCategory2).toBe('Di động');
    expect(f7[0].priceVnd).toBe(10_990_000);
    expect(f7[0].specs?.specsSource).toContain('11.990.000');
  });

  it('prices every product, and formats the figure the sheet prints', () => {
    for (const p of products) {
      expect(p.priceVnd).toBeGreaterThan(0);
      expect(p.priceFormatted).toMatch(/^[\d.]+ đ$/);
    }
  });

  it('has URLs and images populated from B&H Photo Video', () => {
    for (const p of products) {
      expect(p.sku).toBe('');
      expect(p.url).not.toBe('');
      expect(p.imageUrl).not.toBe('');
    }
  });

  it('names every unstated spec in specsMissing, and no stated one', () => {
    for (const p of products) {
      const specs = p.specs;
      if (!specs) throw new Error(`${p.id} has no specs block`);
      const row = specs as unknown as Record<string, string | null>;
      for (const key of SPEC_ROWS[specs.kind]) {
        expect(specs.specsMissing.includes(key)).toBe(row[key] == null);
      }
    }
  });

  it('writes both locales of every feature list', () => {
    for (const p of products) {
      const f = p.features as { en: string[]; vi: string[] };
      expect(f.en.length).toBeGreaterThan(0);
      expect(f.vi).toHaveLength(f.en.length);
    }
  });

  it('resolves a product by id, and nothing by an unknown one', async () => {
    expect((await getSonyAudioById('sony-wh-1000xm6'))?.name).toBe('WH-1000XM6');
    expect(await getSonyAudioById('sony-nope')).toBeNull();
  });
});

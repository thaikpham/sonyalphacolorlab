import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SPEC_ROWS, type CameraSpecs, type HeadphoneSpecs, type ProductSpecs, type SonyCamera } from './types';
import {
  CATEGORIES,
  PRICE_VND_MAX,
  formatPriceVnd,
  isCategory,
  isValidPlacement,
  rebuildSpecs,
  specFieldsDropped,
  specKindFor,
  subCategory1Choices,
  subCategory2Choices,
} from './taxonomy';

/**
 * The taxonomy is read by three writers — the create route, the update route
 * and the editor's selects — and by every public filter chip, which matches the
 * stored string exactly. So it is pinned to the data rather than to a list
 * typed into this file: every row the catalogue actually ships must be a
 * placement the taxonomy accepts, and its spec block must be the kind the
 * taxonomy would give it. A sub-category added to the data without the
 * taxonomy, or to the taxonomy with a different spelling, fails here.
 */

const seed = (path: string) => JSON.parse(readFileSync(path, 'utf8')) as SonyCamera[];
const catalogue = [...seed('data/sony-cameras.seed.json'), ...seed('data/sony-audio.seed.json')];

/** The catalogue's central invariant: every null is declared, nothing declared holds a value. */
function expectMissingMatchesNulls(specs: ProductSpecs) {
  const row = specs as unknown as Record<string, unknown>;
  const nulls = SPEC_ROWS[specs.kind].filter((f) => row[f] === null || row[f] === undefined).sort();
  expect([...specs.specsMissing].sort()).toEqual(nulls);
}

describe('the catalogue taxonomy', () => {
  it('accepts every placement the seeds ship', () => {
    expect(catalogue.length).toBeGreaterThan(100);
    for (const p of catalogue) {
      expect(isCategory(p.category), `${p.id}: category ${p.category}`).toBe(true);
      expect(subCategory1Choices(p.category), `${p.id}: sub1`).toContain(p.subCategory1);
      expect(subCategory2Choices(p.category, p.subCategory1), `${p.id}: sub2`).toContain(p.subCategory2);
      expect(isValidPlacement(p.category, p.subCategory1, p.subCategory2), p.id).toBe(true);
    }
  });

  it('gives every seeded spec block the kind the taxonomy names', () => {
    for (const p of catalogue) {
      if (!p.specs) continue;
      expect(specKindFor(p.category, p.subCategory1), p.id).toBe(p.specs.kind);
    }
  });

  it('reaches every spec kind, and nothing else', () => {
    const kinds = new Set<string>();
    for (const c of CATEGORIES) {
      for (const s1 of subCategory1Choices(c)) {
        const kind = specKindFor(c, s1);
        expect(kind, `${c}/${s1}`).not.toBeNull();
        kinds.add(kind as string);
      }
    }
    expect([...kinds].sort()).toEqual(Object.keys(SPEC_ROWS).sort());
  });

  it('maps each category to its spec kind', () => {
    expect(specKindFor('camera', 'Full Frame')).toBe('camera');
    expect(specKindFor('lens', 'APS-C')).toBe('lens');
    expect(specKindFor('accessory', 'Power')).toBe('accessory');
    expect(specKindFor('audio', 'Tai nghe')).toBe('headphone');
    expect(specKindFor('audio', 'Loa')).toBe('speaker');
    /* Not a guess from a substring: an audio sub-category the taxonomy does not
       know has no kind. The create route used to regex "loa" out of it. */
    expect(specKindFor('audio', 'Loa kéo')).toBeNull();
    expect(specKindFor('audio', '')).toBeNull();
  });

  it('pairs audio’s second level with its first', () => {
    expect(subCategory2Choices('audio', 'Tai nghe')).toEqual(['Choàng đầu', 'Nhét tai', 'Gaming']);
    expect(subCategory2Choices('audio', 'Loa')).toEqual(['Di động', 'Karaoke']);
    expect(isValidPlacement('audio', 'Loa', 'Nhét tai')).toBe(false);
    expect(isValidPlacement('audio', 'Tai nghe', 'Karaoke')).toBe(false);
  });

  it('refuses a placement from another category', () => {
    expect(isValidPlacement('camera', 'Full Frame', 'GM')).toBe(false);
    expect(isValidPlacement('lens', 'Full Frame', 'Cinema Line')).toBe(false);
    expect(isValidPlacement('camera', 'Tai nghe', '')).toBe(false);
    expect(isValidPlacement('phone', 'Full Frame', '')).toBe(false);
    /* The near-miss spelling that once grew its own public chip. */
    expect(isValidPlacement('camera', 'Full-Frame', 'Máy ảnh Alpha')).toBe(false);
  });

  it('allows an empty second level', () => {
    expect(isValidPlacement('lens', 'Adapter', '')).toBe(true);
    expect(isValidPlacement('audio', 'Loa', '')).toBe(true);
  });
});

describe('formatPriceVnd', () => {
  it('writes every seeded price exactly as the seed does', () => {
    for (const p of catalogue) expect(formatPriceVnd(p.priceVnd), p.id).toBe(p.priceFormatted);
  });

  it('uses the đ the catalogue uses, never ₫', () => {
    expect(formatPriceVnd(1234567)).toBe('1.234.567 đ');
    expect(formatPriceVnd(990)).toBe('990 đ');
    expect(formatPriceVnd(PRICE_VND_MAX)).toBe('100.000.000.000 đ');
  });

  it('writes no figure for a product without a price', () => {
    expect(formatPriceVnd(0)).toBe('Liên hệ');
  });
});

const camera = (over: Partial<CameraSpecs> = {}): CameraSpecs => ({
  kind: 'camera',
  specsSource: 'https://www.sony.com.vn/example',
  specsMissing: [],
  sensor: 'Full-Frame Exmor R CMOS BSI',
  effectivePixels: '33,0 MP',
  isoRange: '100–51200',
  autofocus: '759 điểm',
  video: '4K 60p',
  stabilization: '5 trục',
  viewfinder: '3,69 triệu điểm ảnh',
  lcd: '3,0"',
  mediaSlots: 'CFexpress A / SD',
  battery: '580 ảnh',
  weight: '659 g',
  dimensions: '131 x 96 x 80 mm',
  ...over,
});

describe('rebuildSpecs', () => {
  it('keeps the fields the new kind shares, drops the rest and declares the gaps', () => {
    const out = rebuildSpecs(camera(), 'lens') as unknown as Record<string, unknown>;
    expect(out.kind).toBe('lens');
    expect(out.weight).toBe('659 g');
    expect(out.dimensions).toBe('131 x 96 x 80 mm');
    expect(out.stabilization).toBe('5 trục');
    expect(out.focalLength).toBeNull();
    expect(out).not.toHaveProperty('sensor');
    expect(out).not.toHaveProperty('mediaSlots');
    expect(out.specsSource).toBe('https://www.sony.com.vn/example');
    expectMissingMatchesNulls(out as unknown as ProductSpecs);
  });

  it('carries nothing outside the new kind’s rows and its bookkeeping', () => {
    for (const kind of Object.keys(SPEC_ROWS) as ProductSpecs['kind'][]) {
      const out = rebuildSpecs(camera(), kind);
      const allowed = new Set([...SPEC_ROWS[kind], 'kind', 'specsSource', 'specsMissing']);
      if (kind === 'accessory') allowed.add('keySpecs');
      for (const key of Object.keys(out)) expect(allowed.has(key), `${kind}: ${key}`).toBe(true);
      expectMissingMatchesNulls(out);
    }
  });

  it('builds an all-gaps block for a product that has none', () => {
    const out = rebuildSpecs(null, 'accessory', 'https://www.sony.com.vn/ecm-m1');
    expect(out).toEqual({
      kind: 'accessory',
      keySpecs: [],
      compatibility: null,
      weight: null,
      dimensions: null,
      specsSource: 'https://www.sony.com.vn/ecm-m1',
      specsMissing: ['compatibility', 'dimensions', 'weight'],
    });
  });

  it('keeps the source it already had over the fallback', () => {
    expect(rebuildSpecs(camera(), 'lens', 'https://elsewhere.test').specsSource).toBe(
      'https://www.sony.com.vn/example',
    );
  });

  it('keeps an accessory’s key specs only while it stays an accessory', () => {
    const acc = {
      kind: 'accessory' as const,
      keySpecs: [{ label: 'Pattern', value: '8' }],
      compatibility: 'MI Shoe',
      weight: null,
      dimensions: null,
      specsSource: 'https://www.sony.com.vn/a',
      specsMissing: ['dimensions', 'weight'],
    };
    expect((rebuildSpecs(acc, 'accessory') as typeof acc).keySpecs).toEqual([{ label: 'Pattern', value: '8' }]);
    expect(rebuildSpecs(acc, 'camera')).not.toHaveProperty('keySpecs');
  });

  it('moves a headphone to a speaker through the rows they share', () => {
    const hp = {
      kind: 'headphone',
      specsSource: 'Sony Vietnam FY26',
      specsMissing: [],
      battery: '30 giờ',
      fastCharge: '3 phút',
      connectivity: 'Bluetooth 5.3',
      weight: '250 g',
      designType: 'Choàng đầu',
    } as unknown as HeadphoneSpecs;
    const out = rebuildSpecs(hp, 'speaker') as unknown as Record<string, unknown>;
    expect(out.kind).toBe('speaker');
    expect(out.battery).toBe('30 giờ');
    expect(out.connectivity).toBe('Bluetooth 5.3');
    expect(out.weight).toBe('250 g');
    expect(out).not.toHaveProperty('designType');
    expect(out.specsSource).toBe('Sony Vietnam FY26');
    expectMissingMatchesNulls(out as unknown as ProductSpecs);
  });

  it('recomputes specsMissing on a block that keeps its kind', () => {
    const out = rebuildSpecs(camera({ lcd: null, specsMissing: [] }), 'camera');
    expect(out.specsMissing).toEqual(['lcd']);
  });

  it('does not alias the block it was given', () => {
    const before = camera();
    const out = rebuildSpecs(before, 'camera') as CameraSpecs;
    out.weight = 'changed';
    expect(before.weight).toBe('659 g');
  });
});

describe('specFieldsDropped', () => {
  it('names the filled fields a kind change would lose', () => {
    const values = { sensor: 'Exmor', weight: '659 g', lcd: '', video: '  ' };
    expect(specFieldsDropped(values, 'camera', 'lens')).toEqual(['sensor']);
    expect(specFieldsDropped(values, 'camera', 'camera')).toEqual([]);
  });

  it('counts an accessory’s key specs when it stops being one', () => {
    expect(
      specFieldsDropped({ keySpecs: [{ label: 'a', value: 'b' }], weight: '1 g' }, 'accessory', 'lens'),
    ).toEqual(['keySpecs']);
    expect(specFieldsDropped({ keySpecs: [] }, 'accessory', 'lens')).toEqual([]);
  });
});

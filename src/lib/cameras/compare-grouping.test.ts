import { describe, expect, it } from 'vitest';
import { compareSelection, getActiveSpecSections, MAX_COMPARE, SPEC_SECTION_GROUPS, valuesDiffer } from './compare-grouping';
import { SPEC_ROWS, type ProductSpecs, type SonyCamera } from './types';

/**
 * The compare grid draws spec rows only from `SPEC_SECTION_GROUPS`, so a field
 * that is in `SPEC_ROWS` and in no group is silently never compared. That is
 * how every headphone and speaker row went missing: the page loads audio for
 * compare on purpose, and a WH-1000XM6 against an XM5 came out as Battery and
 * Weight alone.
 */

const product = (id: string, specs: Partial<ProductSpecs> & { kind: ProductSpecs['kind'] }): SonyCamera => ({
  id,
  sku: '',
  name: id,
  fullName: id,
  category: specs.kind === 'headphone' || specs.kind === 'speaker' ? 'audio' : specs.kind,
  subCategory1: '',
  subCategory2: '',
  priceVnd: 1,
  priceFormatted: '1 đ',
  url: '',
  imageUrl: '',
  features: [],
  specs: { specsSource: '', specsMissing: [], ...specs } as ProductSpecs,
});

describe('compare groups', () => {
  it.each(Object.entries(SPEC_ROWS))('cover every %s spec row', (_kind, keys) => {
    const grouped = new Set(SPEC_SECTION_GROUPS.flatMap((g) => g.specKeys));
    for (const key of keys) expect(grouped.has(key), key).toBe(true);
  });

  it('put each spec in exactly one group, so no row is drawn twice', () => {
    const keys = SPEC_SECTION_GROUPS.flatMap((g) => g.specKeys);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('show the audio rows for two headphones', () => {
    const cams = [
      product('xm6', { kind: 'headphone', designType: 'Choàng đầu', noiseCancelling: 'Chống ồn' }),
      product('xm5', { kind: 'headphone', designType: 'Choàng đầu', driver: '30mm' }),
    ];
    const sections = getActiveSpecSections(cams, 'all');
    const audio = sections.find((s) => s.id === 'audio');
    expect(audio?.specKeys).toEqual(expect.arrayContaining(['designType', 'noiseCancelling', 'driver']));
    expect(getActiveSpecSections(cams, 'audio').map((s) => s.id)).toEqual(['audio']);
  });

  it('drop a group no compared product has a value for', () => {
    const lenses = [product('a', { kind: 'lens', focalLength: '24-70mm' }), product('b', { kind: 'lens', focalLength: '85mm' })];
    const ids = getActiveSpecSections(lenses, 'all').map((s) => s.id);
    expect(ids).toContain('sensorOptics');
    expect(ids).not.toContain('videoIso');
    expect(ids).not.toContain('audio');
  });

  it('show nothing from the spec groups on the highlights tab', () => {
    expect(getActiveSpecSections([product('a', { kind: 'lens', focalLength: '85mm' })], 'highlights')).toEqual([]);
  });
});

/**
 * `?ids=` is whatever a shared link says. Next hands a repeated key over as an
 * array, which `.split` threw on; nothing capped it at the six the pickers
 * enforce; and ids since deleted from the catalogue held slots, so the Add
 * button opened a picker whose every choice was refused.
 */
describe('compareSelection', () => {
  const known = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

  it('accepts the repeated-key form as well as the comma list', () => {
    expect(compareSelection(['a', 'b'], known)).toEqual(['a', 'b']);
    expect(compareSelection(['a,b', 'c'], known)).toEqual(['a', 'b', 'c']);
  });

  it('drops blanks and repeats, keeping the order given', () => {
    expect(compareSelection('b,a,,b, a', known)).toEqual(['b', 'a']);
  });

  it('drops ids the catalogue no longer has before counting', () => {
    expect(compareSelection('zz,a,yy,xx,ww,vv,b', known)).toEqual(['a', 'b']);
  });

  it(`stops at ${MAX_COMPARE}`, () => {
    expect(compareSelection(known.join(','), known)).toEqual(known.slice(0, MAX_COMPARE));
  });

  it('is empty for no ids at all', () => {
    expect(compareSelection(undefined, known)).toEqual([]);
    expect(compareSelection('', known)).toEqual([]);
  });
});

describe('valuesDiffer', () => {
  it('reads a missing value and a dash as the same, because both render as a dash', () => {
    expect(valuesDiffer([null, '—'])).toBe(false);
    expect(valuesDiffer(['', null, undefined])).toBe(false);
  });

  it('is true only when two rendered values disagree', () => {
    expect(valuesDiffer(['63.990.000 đ', '86.390.182 đ'])).toBe(true);
    expect(valuesDiffer(['679 g', '679 g'])).toBe(false);
    expect(valuesDiffer(['679 g', null])).toBe(true);
  });

  it('never marks a single column as different', () => {
    expect(valuesDiffer(['679 g'])).toBe(false);
    expect(valuesDiffer([])).toBe(false);
  });
});

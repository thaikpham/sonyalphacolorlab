import { describe, expect, it } from 'vitest';
import {
  CORE_SPEC_KEYS,
  draftToHighlights,
  highlightsFor,
  highlightsSchema,
  highlightsToDraft,
  parseHighlights,
  type Highlights,
} from './highlights';

const side = (n = 4) => ({
  points: Array.from({ length: n }, (_, i) => ({ title: `Title ${i + 1}`, body: `Body ${i + 1}.` })),
  keySpecs: [{ key: 'sensor' as const, value: '33MP Full-Frame' }],
});
const valid: Highlights = { en: side(), vi: side() };

describe('highlightsSchema', () => {
  it('accepts 4 to 6 points in each language', () => {
    expect(highlightsSchema.safeParse(valid).success).toBe(true);
    expect(highlightsSchema.safeParse({ en: side(6), vi: side(6) }).success).toBe(true);
  });

  it('refuses fewer than 4 or more than 6 points', () => {
    expect(highlightsSchema.safeParse({ en: side(3), vi: side() }).success).toBe(false);
    expect(highlightsSchema.safeParse({ en: side(), vi: side(7) }).success).toBe(false);
  });

  it('refuses a missing language, an unknown core spec, a repeated one, and stray keys', () => {
    expect(highlightsSchema.safeParse({ en: side() }).success).toBe(false);
    expect(highlightsSchema.safeParse({ en: { ...side(), keySpecs: [{ key: 'iso', value: 'x' }] }, vi: side() }).success).toBe(false);
    const twice = [{ key: 'sensor', value: 'a' }, { key: 'sensor', value: 'b' }];
    expect(highlightsSchema.safeParse({ en: { ...side(), keySpecs: twice }, vi: side() }).success).toBe(false);
    expect(highlightsSchema.safeParse({ ...valid, extra: 1 }).success).toBe(false);
  });
});

describe('parseHighlights', () => {
  it('returns the value when valid and null otherwise, never throwing', () => {
    expect(parseHighlights(valid)).toEqual(valid);
    expect(parseHighlights(null)).toBeNull();
    expect(parseHighlights(undefined)).toBeNull();
    expect(parseHighlights({ en: side(1), vi: side(1) })).toBeNull();
    expect(parseHighlights('nope')).toBeNull();
  });
});

describe('highlightsFor', () => {
  it('picks the locale, English for anything but vi', () => {
    const h = { en: side(4), vi: side(5) };
    expect(highlightsFor(h, 'vi')?.points).toHaveLength(5);
    expect(highlightsFor(h, 'en')?.points).toHaveLength(4);
    expect(highlightsFor(null, 'vi')).toBeNull();
  });
});

describe('the editor draft', () => {
  it('round-trips through the "Title :: body" text form', () => {
    const draft = highlightsToDraft(valid);
    expect(draft.en.points.split('\n')[0]).toBe('Title 1 :: Body 1.');
    expect(draft.en.specs.sensor).toBe('33MP Full-Frame');
    expect(draft.en.specs.weight).toBe('');
    expect(highlightsSchema.parse(draftToHighlights(draft))).toEqual(valid);
  });

  it('is null when nothing is filled in, so a save clears the column', () => {
    expect(draftToHighlights(highlightsToDraft(null))).toBeNull();
  });

  it('keeps core specs in CORE_SPEC_KEYS order and drops empty ones', () => {
    const draft = highlightsToDraft(null);
    draft.en.points = draft.vi.points = 'A :: a\nB :: b\nC :: c\nD :: d';
    draft.en.specs.weight = '658 g';
    draft.en.specs.sensor = '33MP';
    const out = draftToHighlights(draft) as Highlights;
    expect(out.en.keySpecs.map((r) => r.key)).toEqual(['sensor', 'weight']);
    expect(out.vi.keySpecs).toEqual([]);
    expect(CORE_SPEC_KEYS).toHaveLength(8);
  });

  it('leaves a line without " :: " as an empty body, which the schema then refuses', () => {
    const draft = highlightsToDraft(null);
    draft.en.points = draft.vi.points = 'A\nB :: b\nC :: c\nD :: d';
    expect(highlightsSchema.safeParse(draftToHighlights(draft)).success).toBe(false);
  });
});

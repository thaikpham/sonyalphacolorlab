import { describe, expect, it, vi } from 'vitest';
import {
  CORE_SPEC_KEYS,
  draftToHighlights,
  highlightsFor,
  highlightsSchema,
  highlightsToDraft,
  parseHighlights,
  type Highlights,
  type HighlightsSide,
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

  /* Both traps the editor's "Title :: body" text form cannot round-trip: a
     line break turns one point into two (or swallows the break silently), and
     a title containing the literal "::" is cut at the FIRST occurrence, which
     silently drops everything between the first and second separator into the
     title instead of the body. */
  it('refuses a line break inside a title, a body or a core-spec value', () => {
    /* `.trim()` runs before this check, so a LEADING or TRAILING break is
       already gone by the time it would be refused — there is nothing left
       to round-trip badly. Only an embedded one is a real hazard. */
    const withTitle = (title: string) => ({ en: { ...side(), points: [{ title, body: 'b' }, ...side(3).points] }, vi: side() });
    expect(highlightsSchema.safeParse(withTitle('Two\nlines')).success).toBe(false);
    expect(highlightsSchema.safeParse(withTitle('Mid\rdle')).success).toBe(false);

    const withBody = (body: string) => ({ en: { ...side(), points: [{ title: 't', body }, ...side(3).points] }, vi: side() });
    expect(highlightsSchema.safeParse(withBody('Two\nlines')).success).toBe(false);

    const withSpecValue = (value: string) => ({ en: { ...side(), keySpecs: [{ key: 'sensor' as const, value }] }, vi: side() });
    expect(highlightsSchema.safeParse(withSpecValue('33MP\nFull-Frame')).success).toBe(false);
  });

  it('refuses a title containing the "::" separator', () => {
    const withTitle = (title: string) => ({ en: { ...side(), points: [{ title, body: 'b' }, ...side(3).points] }, vi: side() });
    expect(highlightsSchema.safeParse(withTitle('Fast :: AF')).success).toBe(false);
    // The separator survives in a body — only the title is ambiguous.
    const withBody = (body: string) => ({ en: { ...side(), points: [{ title: 't', body }, ...side(3).points] }, vi: side() });
    expect(highlightsSchema.safeParse(withBody('Amber :: blue axis')).success).toBe(true);
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

  it('logs the product id and the Zod issue paths when the stored value fails validation', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(parseHighlights({ en: side(1), vi: side(1) }, 'sony-ilce-7m4-bq-ap2')).toBeNull();
    expect(spy).toHaveBeenCalledTimes(1);
    const [message, paths] = spy.mock.calls[0];
    expect(String(message)).toContain('sony-ilce-7m4-bq-ap2');
    expect(Array.isArray(paths)).toBe(true);
    expect((paths as string[]).length).toBeGreaterThan(0);
    spy.mockRestore();
  });

  it('names the product as unknown when no id is given', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    parseHighlights({ en: side(1), vi: side(1) });
    expect(String(spy.mock.calls[0][0])).toContain('unknown product');
    spy.mockRestore();
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

  /* Every value the refined schema still accepts must survive the text form
     exactly — this is what the title/body/value refinements in the schema
     exist to guarantee, by ruling out the two shapes that cannot. */
  it('round-trips every value the schema accepts, across a few edge strings', () => {
    const edgeCases: HighlightsSide['points'][number][] = [
      { title: 'Edge: colon, not a separator', body: 'Has a colon: still fine, and "quotes" too.' },
      { title: 'Diacritics: lấy nét nhanh', body: 'Theo mắt, 759 điểm AF, tốc độ 1/8000s.' },
      { title: '50/50 — em dash & slash', body: 'Internal   multiple   spaces are kept, not collapsed.' },
      { title: 'Single : colon is fine', body: 'A :: body-like string survives — only a title cannot hold it.' },
    ];
    for (const point of edgeCases) {
      const h: Highlights = { en: { points: [point, point, point, point], keySpecs: [] }, vi: side() };
      expect(highlightsSchema.safeParse(h).success, point.title).toBe(true);
      const roundTripped = highlightsSchema.parse(draftToHighlights(highlightsToDraft(h)));
      expect(roundTripped.en.points[0]).toEqual(point);
    }
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

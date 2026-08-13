import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { translateSpecValue } from './spec-values';
import { SPEC_ROWS, type SonyCamera } from './types';

const cameras = JSON.parse(
  readFileSync(join(process.cwd(), 'data', 'sony-cameras.seed.json'), 'utf8'),
) as SonyCamera[];

/* Diacritics that exist in Vietnamese and not in English. `đ` is included; the
   bare vowels are not, because `a` in "Alpha" is not evidence of anything. */
const VIETNAMESE = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;

/**
 * Values that still read as Vietnamese on `/en` because the seed put the wrong
 * spec in the field — not because a rule is missing. Translating them would
 * launder an extraction bug into something that looks answered, so they are
 * listed here instead and the fix is a re-extraction from `specsSource`.
 *
 * Each entry is [product id, field]. Shrink this list; never grow it to make a
 * failure go away.
 */
const EXTRACTION_BUGS: [string, string][] = [
  /* Power consumption sitting in the LCD field. The ZV-E10 II has the same
     wrong spec in the same row, already in English, so it reads clean and is
     not listed here — the row is still wrong on both. */
  ['sony-zv-e1-bq-ap2', 'lcd'],
];

function isKnownBug(id: string, field: string) {
  return EXTRACTION_BUGS.some(([bugId, bugField]) => bugId === id && bugField === field);
}

function vietnameseValues() {
  const out: { id: string; field: string; value: string }[] = [];
  for (const product of cameras) {
    const specs = product.specs;
    if (!specs) continue;
    const row = specs as unknown as Record<string, string | null>;
    for (const field of SPEC_ROWS[specs.kind]) {
      const value = row[field];
      if (typeof value === 'string' && VIETNAMESE.test(value)) {
        out.push({ id: product.id, field, value });
      }
    }
  }
  return out;
}

describe('spec value translation', () => {
  it('finds Vietnamese in the seed to translate — the fixture is not empty', () => {
    expect(vietnameseValues().length).toBeGreaterThan(100);
  });

  it('leaves every value untouched for vi', () => {
    for (const { field, value } of vietnameseValues()) {
      expect(translateSpecValue(field, value, 'vi')).toBe(value);
    }
  });

  /* The point of the whole file. A missing rule is a Vietnamese word rendered
     to an English reader, and nothing else in the suite would catch it. */
  it('leaves no Vietnamese in any value for en', () => {
    const leaked = vietnameseValues()
      .filter(({ id, field }) => !isKnownBug(id, field))
      .map(({ id, field, value }) => ({ id, field, en: translateSpecValue(field, value, 'en') }))
      .filter((r) => VIETNAMESE.test(r.en));

    expect(leaked).toEqual([]);
  });

  it('keeps the known extraction bugs listed, so the list stays honest', () => {
    for (const [id, field] of EXTRACTION_BUGS) {
      const product = cameras.find((c) => c.id === id);
      expect(product, `${id} is gone from the seed — drop it from EXTRACTION_BUGS`).toBeDefined();
      const value = (product?.specs as unknown as Record<string, string | null>)?.[field];
      expect(
        typeof value === 'string' && VIETNAMESE.test(value),
        `${id}.${field} reads clean now — drop it from EXTRACTION_BUGS`,
      ).toBe(true);
    }
  });

  it('does not touch numbers, units or Sony decimal commas', () => {
    expect(translateSpecValue('weight', '646 g (có pin và thẻ nhớ)', 'en')).toBe(
      '646 g (with battery and card)',
    );
    expect(translateSpecValue('dimensions', '131,3 x 96,4 x 79,8 mm', 'en')).toBe(
      '131,3 x 96,4 x 79,8 mm',
    );
  });

  /* `điểm` is autofocus points in one row and screen dots in the next. The
     rules are keyed by field precisely so these two cannot collapse. */
  it('reads điểm as points for autofocus and dots for the screens', () => {
    expect(translateSpecValue('autofocus', '759 điểm', 'en')).toBe('759 points');
    expect(translateSpecValue('viewfinder', '3 686 400 điểm ảnh', 'en')).toBe('3 686 400 dots');
    expect(translateSpecValue('lcd', '7,5 cm (3.0), 2,36 triệu điểm', 'en')).toBe(
      '7,5 cm (3.0), 2,36 million dots',
    );
  });

  it('returns an unknown field unchanged rather than guessing', () => {
    expect(translateSpecValue('somethingNew', '5 trục', 'en')).toBe('5 trục');
  });
});

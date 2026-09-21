import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { translateSpecValue } from './spec-values';
import { SPEC_ROWS, type SonyCamera } from './types';

const readSeed = (file: string) =>
  JSON.parse(readFileSync(join(process.cwd(), 'data', file), 'utf8')) as SonyCamera[];

/* Audio shares ProductSpecTable with cameras, so its values reach /en through
   the same function and are held to the same rule. */
const products = [...readSeed('sony-cameras.seed.json'), ...readSeed('sony-audio.seed.json')];

/* Diacritics that exist in Vietnamese and not in English. `đ` is included; the
   bare vowels are not, because `a` in "Alpha" is not evidence of anything. */
const DIACRITICS = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;

/* Vietnamese words the seed writes without a single diacritic, which the
   pattern above cannot see. Whole words only: `loa` is Vietnamese, `Load` is
   not. Grow this when a new one turns up. */
const UNMARKED_WORDS = /(?<![\p{L}])(tai nghe|xoay|loa|micro 2|bang so sanh)(?![\p{L}])/iu;

const VIETNAMESE = {
  test: (value: string) => DIACRITICS.test(value) || UNMARKED_WORDS.test(value),
};

/* Rendered on the spec table under its own label, not as a SPEC_ROWS row. */
const EXTRA_FIELDS = ['specsSource'] as const;

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
  /* Empty, and the list is meant to stay that way. The last entry was the
     ZV-E1's power consumption sitting in its LCD field; the seed now carries
     no `lcd` for that body rather than the wrong spec, so there is nothing
     left to exempt. */
];

function isKnownBug(id: string, field: string) {
  return EXTRACTION_BUGS.some(([bugId, bugField]) => bugId === id && bugField === field);
}

function vietnameseValues() {
  const out: { id: string; field: string; value: string }[] = [];
  for (const product of products) {
    const specs = product.specs;
    if (!specs) continue;
    const row = specs as unknown as Record<string, string | null>;
    for (const field of [...SPEC_ROWS[specs.kind], ...EXTRA_FIELDS]) {
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
      const product = products.find((c) => c.id === id);
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

  /* The audio rules are ordered so a shorter pair cannot eat a longer one:
     `Màng loa` alone would leave "Driver Dynamic Driver X". */
  it('renders the audio wording without half-translated leftovers', () => {
    expect(translateSpecValue('driver', 'Màng loa Dynamic Driver X 8.4mm', 'en')).toBe(
      'Dynamic Driver X 8.4mm',
    );
    expect(translateSpecValue('driver', 'Màng loa sợi Carbon Dynamic Driver X 30mm', 'en')).toBe(
      'Carbon fibre Dynamic Driver X 30mm',
    );
    expect(translateSpecValue('battery', '30 giờ + 40 giờ', 'en')).toBe('30 h + 40 h');
    expect(translateSpecValue('fastCharge', '3 phút → 60 phút | Sạc không dây', 'en')).toBe(
      '3 min → 60 min | Wireless charging',
    );
    expect(translateSpecValue('weight', '31 g (tai nghe 4.6 g x 2)', 'en')).toBe(
      '31 g (earbuds 4.6 g x 2)',
    );
    expect(translateSpecValue('waterResistance', 'Kháng nước/bụi IP67', 'en')).toBe(
      'Water/dust resistant IP67',
    );
    expect(translateSpecValue('micPorts', '2 cổng Micro | 1 cổng Guitar', 'en')).toBe(
      '2 mic inputs | 1 guitar input',
    );
    expect(
      translateSpecValue(
        'specsSource',
        'Sony Vietnam FY26 — Các sản phẩm tai nghe & Loa (100426), bảng so sánh',
        'en',
      ),
    ).toBe('Sony Vietnam FY26 — Headphones & Speakers (100426), comparison sheet');
  });

  it('catches Vietnamese written without diacritics', () => {
    expect(VIETNAMESE.test('Xoay')).toBe(true);
    expect(VIETNAMESE.test('31 g (tai nghe 4.6 g x 2)')).toBe(true);
    expect(VIETNAMESE.test('Swivel | Load 5 kg')).toBe(false);
  });

  it('returns an unknown field unchanged rather than guessing', () => {
    expect(translateSpecValue('somethingNew', '5 trục', 'en')).toBe('5 trục');
  });
});

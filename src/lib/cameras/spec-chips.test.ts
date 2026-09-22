import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { translateSpecValue } from './spec-values';
import { toCameraCard, type SonyCamera } from './types';

/**
 * The three figures on a catalogue card, and the one thing that makes them
 * readable in English.
 *
 * Spec values are stored in Vietnamese, and `translateSpecValue` is keyed per
 * field because the same word is two different things across two rows —
 * `điểm` is autofocus points on one and screen dots on the next. `specChips`
 * used to be a flat `string[]`, which threw that key away at the point the
 * projection was built, so the card printed `425 điểm` to an English reader
 * while the rule to render `425 points` already existed and already passed its
 * own test one file over. Nothing failed; it was simply never asked.
 *
 * So this asserts the pairing survives, and then asserts the outcome that
 * pairing exists for: no diacritic reaches `/en` through a chip.
 */

const readSeed = (file: string) =>
  JSON.parse(readFileSync(`data/${file}`, 'utf8')) as SonyCamera[];

const products = [...readSeed('sony-cameras.seed.json'), ...readSeed('sony-audio.seed.json')];

/* Same detector as `spec-values.test.ts`. Prices are excluded: `đ` is the
   currency symbol and a VND figure is not a translation failure. */
const DIACRITICS =
  /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;

describe('catalogue card chips', () => {
  it('finds chips to check — the fixture is not empty', () => {
    const total = products.reduce((n, p) => n + toCameraCard(p).specChips.length, 0);
    expect(total).toBeGreaterThan(100);
  });

  it('carries the field beside every value, never a bare string', () => {
    for (const product of products) {
      for (const chip of toCameraCard(product).specChips) {
        expect(typeof chip.field, `${product.id} lost its chip field`).toBe('string');
        expect(chip.field.length).toBeGreaterThan(0);
        expect(chip.value.length).toBeGreaterThan(0);
      }
    }
  });

  it('leaves no Vietnamese in a chip rendered for en', () => {
    const leaked = products.flatMap((product) =>
      toCameraCard(product)
        .specChips.map((chip) => ({
          id: product.id,
          field: chip.field,
          en: translateSpecValue(chip.field, chip.value, 'en'),
        }))
        .filter((c) => DIACRITICS.test(c.en)),
    );

    expect(leaked).toEqual([]);
  });

  it('leaves every chip untouched for vi', () => {
    for (const product of products) {
      for (const chip of toCameraCard(product).specChips) {
        expect(translateSpecValue(chip.field, chip.value, 'vi')).toBe(chip.value);
      }
    }
  });
});

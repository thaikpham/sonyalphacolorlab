import { describe, expect, it } from 'vitest';
import { featureList, needsTranslation, splitFeatures } from './features';

describe('bilingual features', () => {
  it('reads a flat array as English — that is the seed’s shape', () => {
    expect(splitFeatures(['33MP Sensor'])).toEqual({ en: ['33MP Sensor'], vi: [] });
  });

  it('reads the object shape the admin UI writes', () => {
    expect(splitFeatures({ en: ['a'], vi: ['b'] })).toEqual({ en: ['a'], vi: ['b'] });
  });

  /* The failure this guards is silent: an object rendered by a `.map()` that
     expected an array puts `[object Object]` on a public page, and only for the
     products an admin has already touched. */
  it('never returns a non-array for any shape', () => {
    for (const input of [null, undefined, 'nope', 42, {}, { en: 'x' }] as never[]) {
      const { en, vi } = splitFeatures(input);
      expect(Array.isArray(en) && Array.isArray(vi)).toBe(true);
    }
  });

  it('drops blank lines rather than rendering empty bullets', () => {
    expect(splitFeatures({ en: ['a', '', '   '], vi: [] }).en).toEqual(['a']);
  });

  it('falls back to English when Vietnamese is missing', () => {
    expect(featureList(['Only English'], 'vi')).toEqual(['Only English']);
  });

  it('falls back to Vietnamese when English is missing', () => {
    expect(featureList({ en: [], vi: ['Chỉ tiếng Việt'] }, 'en')).toEqual(['Chỉ tiếng Việt']);
  });

  it('prefers the requested locale when both exist', () => {
    const f = { en: ['English'], vi: ['Tiếng Việt'] };
    expect(featureList(f, 'vi')).toEqual(['Tiếng Việt']);
    expect(featureList(f, 'en')).toEqual(['English']);
  });

  it('flags a product that still needs a Vietnamese pass', () => {
    expect(needsTranslation(['a'])).toBe(true);
    expect(needsTranslation({ en: ['a'], vi: ['b'] })).toBe(false);
    /* Nothing to translate is not the same as translation pending; an empty
       product must not sit in the admin queue forever. */
    expect(needsTranslation([])).toBe(false);
  });
});

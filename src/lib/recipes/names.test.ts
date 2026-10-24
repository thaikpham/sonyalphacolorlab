import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import recipesSeed from '../../../data/recipes.seed.json';
import type { Recipe } from '../camera/schema';
import {
  NAME_VOCABULARY,
  RECIPE_NAME_RE,
  RECIPE_NAMES,
  TONE_WORDS,
  parseRecipeName,
} from './names';
import { paletteFor } from '../camera/palette';
import { designedLightFor, taxonomyFor } from './taxonomy-assign';
import { TONES } from './taxonomy';

const seed = recipesSeed as unknown as (Recipe & { legacyId?: string | null })[];

/* The Sony Asia recipes are the ones with a photographer's credit; the kept
   legacy Picture Profiles are the ones with a legacy id. Together they are
   every recipe whose name is not written in an originals file. */
const sonyAsia = new Set(
  (JSON.parse(readFileSync('data/sony-asia-credits.json', 'utf8')) as { recipeId: string }[]).map(
    (c) => c.recipeId,
  ),
);
const notOurs = seed.filter((r) => Boolean(r.legacyId) || sonyAsia.has(r.id));

const numberOf = (id: string) => id.slice(-3);

describe('the name syntax', () => {
  it('parses the two shapes and refuses everything else', () => {
    expect(parseRecipeName('PP-048-Soft Clean Portrait')).toEqual({
      format: 'pp',
      number: '048',
      words: ['Soft', 'Clean', 'Portrait'],
    });
    expect(parseRecipeName('CL-001-Film Hard Faded')).toEqual({
      format: 'cl',
      number: '001',
      words: ['Film', 'Hard', 'Faded'],
    });
    expect(parseRecipeName('PP-080-Range HLG Daylight')?.words).toEqual(['Range', 'HLG', 'Daylight']);
    for (const bad of [
      'SCL-PP-001: Mojave Sun', // the old shape
      'PP-48-Soft Clean', // two digits
      'PP-048-Soft', // one word
      'PP-048-Soft Clean Bright Portrait', // four words
      'PP-048-soft clean', // not Title Case
      'PP-048-Huế Silk', // diacritics
      'XX-048-Soft Clean',
      'PP-048 Soft Clean',
    ]) {
      expect(parseRecipeName(bad), bad).toBeNull();
      expect(RECIPE_NAME_RE.test(bad), bad).toBe(false);
    }
  });

  it('is the closed vocabulary, word for word', () => {
    /* Restated on purpose: adding a word must change this test as well as
       names.ts, so a name can never widen the list by itself. 'Base' is the
       one word beyond the spec's list, for PP-081-Flat Log Base. */
    expect([...NAME_VOCABULARY].sort()).toEqual(
      [
        'Warm', 'Cool', 'Neutral', 'Golden', 'Amber', 'Orange', 'Teal', 'Cyan',
        'Violet', 'Jade', 'Green', 'Rosy', 'Silver', 'Sepia', 'Mono',
        'Soft', 'Hard', 'Matte', 'Deep', 'Punchy', 'Airy', 'Crisp', 'Flat', 'Faded',
        'Dense', 'Bright', 'Dark',
        'Vivid', 'Muted', 'Pastel', 'Rich', 'Clean', 'Natural',
        'Portrait', 'Street', 'Night', 'Film', 'Cinema', 'Noir', 'Daylight', 'Dusk',
        'Tungsten', 'Indoor', 'Range', 'Log', 'HLG', 'Pop', 'Studio', 'Table',
        'Coast', 'Nature', 'Festival', 'Autumn', 'Monsoon', 'Overcast', 'Velvet',
        'Cream', 'Slide', 'Standard', 'Instant', 'Product', 'Stream', 'Landscape',
        'Nostalgia', 'Tropical', 'Base',
      ].sort(),
    );
  });

  it('has a closed vocabulary of Title Case English words', () => {
    for (const w of NAME_VOCABULARY) expect(w, w).toMatch(/^(?:[A-Z][a-z]+|HLG)$/);
    for (const words of Object.values(TONE_WORDS)) {
      for (const w of words) expect(NAME_VOCABULARY.has(w), w).toBe(true);
    }
    expect(Object.keys(TONE_WORDS).sort()).toEqual([...TONES].sort());
  });
});

describe('every recipe in the seed', () => {
  it('is named PP-NNN or CL-NNN after its own id and format', () => {
    for (const r of seed) {
      const parsed = parseRecipeName(r.name);
      expect(parsed, `${r.id}: ${r.name}`).not.toBeNull();
      expect(parsed?.format, r.id).toBe(r.format);
      expect(parsed?.number, r.id).toBe(numberOf(r.id));
    }
  });

  it('uses only vocabulary words', () => {
    for (const r of seed) {
      for (const w of parseRecipeName(r.name)?.words ?? []) {
        expect(NAME_VOCABULARY.has(w), `${r.id}: ${w}`).toBe(true);
      }
    }
  });

  it('has a unique name and a unique set of mood words', () => {
    /* Two recipes must never read as the same thing with a different number. */
    const names = seed.map((r) => r.name);
    expect(new Set(names).size).toBe(names.length);
    const sets = new Map<string, string>();
    for (const r of seed) {
      const key = [...(parseRecipeName(r.name)?.words ?? [])].sort().join(' ');
      expect(sets.get(key), `${r.id} repeats the words of ${sets.get(key)}`).toBeUndefined();
      sets.set(key, r.id);
    }
  });

  it('names a temperature only when it agrees with the recipe’s tone', () => {
    for (const r of seed) {
      const words = parseRecipeName(r.name)?.words ?? [];
      const { tone } = taxonomyFor(r);
      for (const [named, toneWords] of Object.entries(TONE_WORDS)) {
        for (const w of words) {
          if (toneWords.includes(w)) expect(tone, `${r.id} is named ${w}`).toBe(named);
        }
      }
    }
  });

  /* The name is read beside the palette, so a "Warm" name over a blue palette
     is a contradiction on screen whatever the editor's tone says. The mid
     swatch carries the white-balance cast purest; its projection on the amber
     axis (hue 65) must lean the way the name does, read under the light the
     recipe is built for. Mono names are checked by the tone rule above. */
  it('names a temperature only when its palette leans that way', () => {
    const AMBER = 65;
    for (const r of seed) {
      const words = parseRecipeName(r.name)?.words ?? [];
      const warm = words.some((w) => TONE_WORDS.warm.includes(w));
      const cool = words.some((w) => TONE_WORDS.cool.includes(w));
      if (!warm && !cool) continue;
      const mid = paletteFor(r, { light: designedLightFor(r.id) ?? undefined }).find((s) => s.id === 'mid')!;
      const lean = mid.c * Math.cos(((mid.h - AMBER) * Math.PI) / 180);
      if (warm) expect(lean, `${r.id} "${r.name}" names warm, its palette leans ${lean.toFixed(3)}`).toBeGreaterThan(0.005);
      if (cool) expect(lean, `${r.id} "${r.name}" names cool, its palette leans ${lean.toFixed(3)}`).toBeLessThan(-0.005);
    }
  });
});

describe('RECIPE_NAMES', () => {
  it('names exactly the recipes whose source is not ours', () => {
    expect(notOurs.length).toBeGreaterThan(0);
    expect(Object.keys(RECIPE_NAMES).sort()).toEqual(notOurs.map((r) => r.id).sort());
  });

  it('is what the seed carries for them', () => {
    for (const r of notOurs) expect(r.name, r.id).toBe(RECIPE_NAMES[r.id]);
  });
});

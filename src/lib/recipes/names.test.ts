import { describe, expect, it } from 'vitest';
import recipesSeed from '../../../data/recipes.seed.json';
import { CREATIVE_LOOKS, RECIPE_FORMATS } from '../camera/constants';
import { monochromeOf } from '../camera/color';
import { paletteFor } from '../camera/palette';
import type { Recipe } from '../camera/schema';
import {
  COLOUR_WORDS,
  DETAIL_WORDS,
  KEY_WORDS,
  MONO_WORDS,
  NAME_VOCABULARY,
  RECIPE_NAME_RE,
  TEMPERATURE_WORDS,
  TONALITY_WORDS,
  TONE_WORDS,
  nameFor,
  namesFor,
  parseRecipeName,
  readName,
  slugFor,
} from './names';
import { SITUATION_SYNONYMS, TONES } from './taxonomy';
import { TAXONOMY_MANIFEST, designedLightFor, taxonomyFor } from './taxonomy-assign';

const seed = recipesSeed as unknown as Recipe[];
const byId = new Map(seed.map((r) => [r.id, r]));
const numberOf = (id: string) => id.slice(-3);
const wordsOf = (name: string) => parseRecipeName(name)?.words ?? [];

describe('the name syntax', () => {
  it('parses three or four words and refuses everything else', () => {
    expect(parseRecipeName('PP-048-Neutral Soft Rich')).toEqual({
      format: 'pp',
      number: '048',
      words: ['Neutral', 'Soft', 'Rich'],
    });
    expect(parseRecipeName('CL-007-Neutral Even Natural Crisp')?.words).toEqual([
      'Neutral',
      'Even',
      'Natural',
      'Crisp',
    ]);
    for (const bad of [
      'SCL-PP-001: Mojave Sun', // the oldest shape
      'PP-48-Warm Deep Rich', // two digits
      'PP-048-Warm Deep', // two words
      'PP-048-Warm Deep Rich Dark Crisp', // five words
      'PP-048-warm deep rich', // not Title Case
      'PP-048-Huế Deep Rich', // diacritics
      'XX-048-Warm Deep Rich',
      'PP-048 Warm Deep Rich',
    ]) {
      expect(parseRecipeName(bad), bad).toBeNull();
      expect(RECIPE_NAME_RE.test(bad), bad).toBe(false);
    }
  });

  it('is the closed vocabulary, word for word', () => {
    /* Restated on purpose: a new word must change this test as well as the
       reading in names.ts, so a name can never widen the list by itself. */
    expect([...NAME_VOCABULARY].sort()).toEqual(
      [
        'Golden', 'Warm', 'Neutral', 'Cool', 'Icy', 'Rosy', 'Mint', 'Mono', 'Sepia',
        'Flat', 'Matte', 'Deep', 'Soft', 'Punchy', 'Faded', 'Airy', 'Even',
        'Vivid', 'Rich', 'Natural', 'Muted', 'Pale',
        'Crisp', 'Gentle', 'Plain',
        'Bright', 'Dark',
      ].sort(),
    );
    for (const w of NAME_VOCABULARY) expect(w, w).toMatch(/^[A-Z][a-z]+$/);
    for (const words of Object.values(TONE_WORDS)) {
      for (const w of words) expect(NAME_VOCABULARY.has(w), w).toBe(true);
    }
    expect(Object.keys(TONE_WORDS).sort()).toEqual([...TONES].sort());
  });

  /* The owner's rule (2026-10-28): no place, no situation, no Look, no film
     stock, no brand, no person — a name says what the settings do. */
  it('has no word that names a situation, a Look, a place, a stock or a brand', () => {
    const fold = (s: string) => s.toLowerCase();
    const situations = new Set(Object.values(SITUATION_SYNONYMS).flat().map(fold));
    /* Three N3 words are also Look labels. Each is a graded reading here —
       a temperature band, a saturation step, monochromeOf() = sepia — so they
       stay, and they are the only ones: a fourth Look label fails. */
    const GRADED_LOOK_LABELS = new Set(['Neutral', 'Vivid', 'Sepia']);
    const looks = new Set(
      CREATIVE_LOOKS.flatMap((l) => [l.code, l.label]).filter((w) => !GRADED_LOOK_LABELS.has(w)).map(fold),
    );
    const BANNED = [
      // the words the hand-picked names used for a use, a time or a place
      'Portrait', 'Street', 'Night', 'Studio', 'Table', 'Coast', 'Nature', 'Festival', 'Autumn',
      'Monsoon', 'Overcast', 'Indoor', 'Stream', 'Landscape', 'Product', 'Daylight', 'Dusk',
      'Tungsten', 'Tropical', 'Nostalgia',
      // a process, a stock or a Look by another name
      'Film', 'Cinema', 'Noir', 'Slide', 'Instant', 'Standard', 'Log', 'Base', 'Range', 'Velvet',
      'Cream', 'Pop', 'Kodak', 'Fuji', 'Portra', 'Velvia', 'Ektar', 'Polaroid',
      // brands, and the places the former names carried
      'Sony', 'Canon', 'Nikon', 'Leica', 'Mojave', 'Kyoto', 'Urban', 'Saigon',
    ].map(fold);
    for (const w of NAME_VOCABULARY) {
      expect(situations.has(fold(w)), `${w} is a situation`).toBe(false);
      expect(looks.has(fold(w)), `${w} is a Creative Look`).toBe(false);
      expect(BANNED.includes(fold(w)), `${w} is banned`).toBe(false);
    }
    for (const w of GRADED_LOOK_LABELS) expect(CREATIVE_LOOKS.some((l) => l.label === w), w).toBe(true);
  });
});

describe('slugFor', () => {
  it('is the code, lowercased, in either id shape', () => {
    expect(slugFor('PP-048')).toBe('pp-048');
    expect(slugFor('CL-007')).toBe('cl-007');
    expect(slugFor('SCL-CL-045')).toBe('cl-045');
  });
});

/* --------------------------------------------------------------------- */

const PP: Extract<Recipe, { format: 'pp' }> = {
  id: 'PP-900',
  slug: 'pp-900',
  name: 'PP-900',
  format: 'pp',
  published: false,
  tags: [],
  whiteBalance: { mode: 'kelvin', kelvin: 5500 },
  settings: {
    blackLevel: 0,
    gamma: 'Still',
    blackGamma: { range: 'Middle', level: 0 },
    knee: { mode: 'Auto', sensitivity: 'Mid' },
    colorMode: 'Still',
    saturation: 0,
    colorPhase: 0,
    colorDepth: { R: 0, G: 0, B: 0, C: 0, M: 0, Y: 0 },
    detail: { level: 0, mode: 'Auto', vhBalance: 0, bwBalance: 'Type3', limit: 0, crispening: 0, hiLightDetail: 0 },
  },
};

const CL: Extract<Recipe, { format: 'cl' }> = {
  id: 'CL-900',
  slug: 'cl-900',
  name: 'CL-900',
  format: 'cl',
  published: false,
  tags: [],
  whiteBalance: { mode: 'kelvin', kelvin: 5500 },
  settings: { look: 'ST', contrast: 0, highlights: 0, shadows: 0, fade: 0, saturation: 0, sharpness: 4, sharpnessRange: 3, clarity: 0 },
};

const pp = (patch: Partial<typeof PP.settings>, wb = PP.whiteBalance, id = PP.id) => ({
  ...PP,
  id,
  whiteBalance: wb,
  settings: { ...PP.settings, ...patch },
});
const cl = (patch: Partial<typeof CL.settings>, wb = CL.whiteBalance, id = CL.id) => ({
  ...CL,
  id,
  whiteBalance: wb,
  settings: { ...CL.settings, ...patch },
});
const words = (r: Recipe) => readName(r).words;

describe('the reading', () => {
  it('names an untouched profile Neutral Even Natural', () => {
    expect(words(PP)).toEqual(['Neutral', 'Even', 'Natural']);
    expect(words(CL)).toEqual(['Neutral', 'Even', 'Natural']);
    expect(nameFor(PP)).toBe('PP-900-Neutral Even Natural');
  });

  it('grades the temperature off the palette, ends of the Kelvin range included', () => {
    expect(words(pp({}, { mode: 'kelvin', kelvin: 9900 }))[0]).toBe('Golden');
    expect(words(pp({}, { mode: 'kelvin', kelvin: 6500 }))[0]).toBe('Warm');
    expect(words(pp({}, { mode: 'kelvin', kelvin: 4500 }))[0]).toBe('Cool');
    expect(words(pp({}, { mode: 'kelvin', kelvin: 2500 }))[0]).toBe('Icy');
    expect(words(pp({}, { mode: 'kelvin', kelvin: 5500, shift: { gm: { axis: 'M', amount: 4 } } }))[0]).toBe('Rosy');
    expect(words(pp({}, { mode: 'kelvin', kelvin: 5500, shift: { gm: { axis: 'G', amount: 4 } } }))[0]).toBe('Mint');
    // Inside one shift step of neutral a shifted cast names no side (wbSummary's
    // rule); the same cast from a bare Kelvin does.
    expect(words(pp({}, { mode: 'kelvin', kelvin: 5500, shift: { ab: { axis: 'B', amount: 0.75 } } }))[0]).toBe('Neutral');
    expect(words(pp({}, { mode: 'kelvin', kelvin: 5100 }))[0]).toBe('Cool');
    // A tint the amber–blue lean outweighs does not take the slot.
    expect(words(pp({}, { mode: 'kelvin', kelvin: 9900, shift: { gm: { axis: 'M', amount: 1 } } }))[0]).toBe('Golden');
  });

  it('names a monochrome recipe Mono or Sepia, and its detail instead of its colour', () => {
    expect(words(pp({ colorMode: 'Black & White', detail: { ...PP.settings.detail, level: 3 } }))).toEqual(['Mono', 'Even', 'Crisp']);
    expect(words(pp({ colorMode: 'Black & White', detail: { ...PP.settings.detail, level: -3 } }))[2]).toBe('Gentle');
    expect(words(pp({ colorMode: 'Black & White' }))[2]).toBe('Plain');
    expect(words(cl({ look: 'BW', saturation: undefined, sharpness: 0, clarity: 0 }))).toEqual(['Mono', 'Even', 'Gentle']);
    expect(words(cl({ look: 'SE', saturation: undefined, clarity: 7 }))).toEqual(['Sepia', 'Even', 'Crisp']);
    expect(words(cl({ look: 'SE', saturation: undefined, sharpness: 3 }))[2]).toBe('Plain');
  });

  it('names the most salient contrast setting', () => {
    expect(words(pp({ gamma: 'S-Log3', colorMode: 'S-Gamut3.Cine', blackLevel: -15 }))[1]).toBe('Flat');
    expect(words(pp({ gamma: 'HLG3', colorMode: 'BT.2020' }))[1]).toBe('Flat');
    expect(words(pp({ blackLevel: 6 }))[1]).toBe('Matte');
    expect(words(pp({ blackLevel: -6 }))[1]).toBe('Deep');
    expect(words(pp({ blackGamma: { range: 'Wide', level: 5 }, blackLevel: -6 }))[1]).toBe('Matte');
    expect(words(pp({ knee: { mode: 'Manual', point: 80, slope: -5 }, blackLevel: -6 }))[1]).toBe('Soft');
    expect(words(cl({ contrast: 5 }))[1]).toBe('Punchy');
    expect(words(cl({ contrast: -5 }))[1]).toBe('Soft');
    expect(words(cl({ fade: 2 }))[1]).toBe('Matte');
    expect(words(cl({ fade: 8 }))[1]).toBe('Faded');
    expect(words(cl({ highlights: 9 }))[1]).toBe('Airy');
    expect(words(cl({ highlights: 3 }))[1]).toBe('Even'); // mild Highlights names nothing
    expect(words(cl({ shadows: -9 }))[1]).toBe('Deep');
    expect(words(cl({ shadows: 9 }))[1]).toBe('Even');
  });

  it('grades the colour from Saturation and mean Color Depth, on each format’s own range', () => {
    expect(words(pp({ saturation: 32 }))[2]).toBe('Vivid');
    expect(words(pp({ saturation: 8 }))[2]).toBe('Rich');
    expect(words(pp({ saturation: -8 }))[2]).toBe('Muted');
    expect(words(pp({ saturation: -32 }))[2]).toBe('Pale');
    expect(words(pp({ saturation: 12, colorDepth: { R: 4, G: 4, B: 4, C: 4, M: 4, Y: 4 } }))[2]).toBe('Vivid');
    // Saturation 9 is a full throw on a Creative Look and a mild one on a Picture Profile.
    expect(words(cl({ saturation: 9 }))[2]).toBe('Vivid');
    expect(words(pp({ saturation: 9 }))[2]).toBe('Rich');
  });

  it('breaks a tie with a fourth word, the same whatever order the catalogue comes in', () => {
    const first = cl({ sharpness: 9 }, CL.whiteBalance, 'CL-901');
    const second = cl({ sharpness: 9, shadows: -4 }, CL.whiteBalance, 'CL-902');
    const third = cl({ sharpness: 9, shadows: -4 }, CL.whiteBalance, 'CL-903');
    const names = namesFor([third, second, first]);
    expect(names.get('CL-901')).toBe('CL-901-Neutral Even Natural');
    expect(names.get('CL-902')).toBe('CL-902-Neutral Even Natural Crisp');
    expect(names.get('CL-903')).toBe('CL-903-Neutral Even Natural Dark');
    expect(namesFor([first, second, third])).toEqual(names);
    expect(nameFor(third, [first, second])).toBe(names.get('CL-903'));
    // Picture Profiles are named first, so a profile never yields its words to a Look.
    expect(namesFor([cl({}, CL.whiteBalance, 'CL-001'), pp({}, PP.whiteBalance, 'PP-099')]).get('PP-099')).toBe(
      'PP-099-Neutral Even Natural',
    );
  });
});

/* --------------------------------------------------------------------- */

describe('every recipe in the seed', () => {
  it('is named by nameFor, from its own settings', () => {
    const names = namesFor(seed);
    for (const r of seed) {
      expect(r.name, r.id).toBe(names.get(r.id));
      expect(r.name, r.id).toBe(nameFor(r, seed));
    }
  });

  it('is named PP-NNN or CL-NNN after its own id and format, in vocabulary words only', () => {
    for (const r of seed) {
      const parsed = parseRecipeName(r.name);
      expect(parsed, `${r.id}: ${r.name}`).not.toBeNull();
      expect(parsed?.format, r.id).toBe(r.format);
      expect(parsed?.number, r.id).toBe(numberOf(r.id));
      for (const w of parsed?.words ?? []) expect(NAME_VOCABULARY.has(w), `${r.id}: ${w}`).toBe(true);
    }
    expect(new Set(seed.map((r) => r.name)).size).toBe(seed.length);
  });

  it('gives every recipe its code as its slug, so a name moves no URL', () => {
    for (const r of seed) expect(r.slug, r.id).toBe(slugFor(r.id));
  });

  it('says temperature, tonality, colour in that order', () => {
    for (const r of seed) {
      const [t, tone, third] = wordsOf(r.name);
      const mono = monochromeOf(r) !== null;
      expect((mono ? MONO_WORDS : TEMPERATURE_WORDS) as readonly string[], `${r.id} ${r.name}`).toContain(t);
      expect(TONALITY_WORDS as readonly string[], `${r.id} ${r.name}`).toContain(tone);
      expect((mono ? DETAIL_WORDS : COLOUR_WORDS) as readonly string[], `${r.id} ${r.name}`).toContain(third);
    }
  });

  it('starts with Mono or Sepia exactly when it is monochrome', () => {
    for (const r of seed) {
      const mono = monochromeOf(r);
      const first = wordsOf(r.name)[0];
      if (mono === 'bw') expect(first, r.id).toBe('Mono');
      else if (mono === 'sepia') expect(first, r.id).toBe('Sepia');
      else expect(MONO_WORDS as readonly string[], r.id).not.toContain(first);
    }
  });

  it('takes a fourth word only to tell it from an earlier recipe', () => {
    const order = [...seed].sort(
      (a, b) => RECIPE_FORMATS.indexOf(a.format) - RECIPE_FORMATS.indexOf(b.format) || numberOf(a.id).localeCompare(numberOf(b.id)),
    );
    const bases = new Set<string>();
    for (const r of order) {
      const w = wordsOf(r.name);
      const base = w.slice(0, 3).join(' ');
      if (w.length === 4) {
        expect(bases.has(base), `${r.name} has a fourth word but no earlier recipe reads ${base}`).toBe(true);
        expect(w.slice(0, 3), r.name).not.toContain(w[3]);
        expect([...DETAIL_WORDS, ...KEY_WORDS, 'Rosy', 'Mint'], r.name).toContain(w[3]);
      }
      bases.add(base);
    }
  });

  /* The name is read beside the palette, so a "Warm" name over a blue palette
     would be a contradiction on screen. The mid swatch carries the
     white-balance cast purest; its projection on the amber axis (hue 65)
     must lean the way the name does, under the light the recipe is built for. */
  it('names a temperature only when its palette leans that way', () => {
    const AMBER = 65;
    for (const r of seed) {
      const w = wordsOf(r.name);
      const warm = w.some((x) => TONE_WORDS.warm.includes(x));
      const cool = w.some((x) => TONE_WORDS.cool.includes(x));
      if (!warm && !cool) continue;
      const mid = paletteFor(r, { light: designedLightFor(r.id) ?? undefined }).find((s) => s.id === 'mid')!;
      const lean = mid.c * Math.cos(((mid.h - AMBER) * Math.PI) / 180);
      if (warm) expect(lean, `${r.id} "${r.name}" names warm, its palette leans ${lean.toFixed(3)}`).toBeGreaterThan(0.005);
      if (cool) expect(lean, `${r.id} "${r.name}" names cool, its palette leans ${lean.toFixed(3)}`).toBeLessThan(-0.005);
    }
  });

  /* Where an editor has set the tone in data/recipe-taxonomy.json, the
     editor's word stands and the name may read otherwise (the editor reads
     the scene; the name reads the palette) — those are reported, not pinned.
     Where the tone is read off the White Balance alone, the two must agree,
     except for the Creative Looks listed here, whose Look and dials move the
     palette's cast where the White Balance cannot see: Instant lays its own
     warm cast over AWB (CL-020); Film's lower chroma and Saturation −2 take
     Cloudy A1.5 back inside one shift step of neutral (CL-002). A new
     disagreement fails until an editor sets that recipe's tone or it is added
     here with its reason. */
  it('agrees with the browse tone the White Balance gives, where no editor set one', () => {
    const LOOK_MOVES_THE_CAST = ['CL-002', 'CL-020'];
    const disagree: string[] = [];
    for (const r of seed) {
      if (TAXONOMY_MANIFEST[r.id]?.tone) continue;
      const first = wordsOf(r.name)[0];
      const { tone } = taxonomyFor(r);
      const claimed = (Object.entries(TONE_WORDS) as [string, readonly string[]][]).find(([, ws]) => ws.includes(first))?.[0];
      if (claimed && claimed !== tone) disagree.push(r.id);
    }
    expect(disagree.sort()).toEqual(LOOK_MOVES_THE_CAST);
    for (const id of LOOK_MOVES_THE_CAST) expect(byId.get(id)?.format, id).toBe('cl');
  });
});

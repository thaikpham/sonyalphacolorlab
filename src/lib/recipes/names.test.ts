import { describe, expect, it } from 'vitest';
import recipesSeed from '../../../data/recipes.seed.json';
import {
  CL_RANGES,
  CREATIVE_LOOK_CODES,
  CREATIVE_LOOKS,
  PP_COLOR_MODE,
  PP_GAMMA,
  PP_RANGES,
  WB_KELVIN,
  WB_SHIFT_AXIS,
} from '../camera/constants';
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
  TINT_WORDS,
  TONALITY_WORDS,
  TONE_WORDS,
  comboOf,
  nameFor,
  namesFor,
  parseRecipeName,
  readName,
  readNames,
  readsAlike,
  slugFor,
} from './names';
import { SITUATION_SYNONYMS, TONES } from './taxonomy';
import { TAXONOMY_MANIFEST, designedLightFor, taxonomyFor } from './taxonomy-assign';

const seed = recipesSeed as unknown as Recipe[];
const byId = new Map(seed.map((r) => [r.id, r]));
const wordsOf = (name: string) => parseRecipeName(name)?.words ?? [];

describe('the name syntax', () => {
  it('parses exactly three words and refuses everything else', () => {
    expect(parseRecipeName('PP-048-Neutral Soft Rich')).toEqual({
      format: 'pp',
      number: '048',
      words: ['Neutral', 'Soft', 'Rich'],
    });
    for (const bad of [
      'SCL-PP-001: Mojave Sun', // the oldest shape
      'PP-48-Warm Deep Rich', // two digits
      'PP-048-Warm Deep', // two words
      'CL-007-Neutral Even Natural Crisp', // four: the shape a tie-break used to add
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
        'Matte', 'Faded', 'Deep', 'Punchy', 'Soft', 'Flat', 'Airy', 'Even',
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
  it('has no word that names a situation, a Look, a place, a stock, a brand or a person', () => {
    const fold = (s: string) => s.toLowerCase();
    const situations = new Set(Object.values(SITUATION_SYNONYMS).flat().map(fold));
    /* Three words are also Look labels. Each is a graded reading here — a
       temperature band, a chroma grade, monochromeOf() = sepia — so they
       stay, and they are the only ones: a fourth Look label fails. */
    const GRADED_LOOK_LABELS = new Set(['Neutral', 'Vivid', 'Sepia']);
    const looks = new Set(
      CREATIVE_LOOKS.flatMap((l) => [l.code, l.label]).filter((w) => !GRADED_LOOK_LABELS.has(w)).map(fold),
    );
    const BANNED = [
      // the words the hand-picked names used for a use, a time or a place
      'Portrait', 'Street', 'Night', 'Studio', 'Table', 'Coast', 'Nature', 'Festival', 'Autumn',
      'Monsoon', 'Overcast', 'Indoor', 'Stream', 'Landscape', 'Product', 'Daylight', 'Dusk',
      'Tungsten', 'Tropical', 'Nostalgia', 'Sun', 'Jade', 'Teal',
      // a process, a stock or a Look by another name
      'Film', 'Cinema', 'Noir', 'Slide', 'Instant', 'Standard', 'Log', 'Base', 'Range', 'Velvet',
      'Cream', 'Pop', 'Kodak', 'Fuji', 'Portra', 'Velvia', 'Ektar', 'Polaroid',
      // brands, and the places and people the former names carried
      'Sony', 'Canon', 'Nikon', 'Leica', 'Mojave', 'Kyoto', 'Urban', 'Saigon', 'Raoul', 'Rutnam',
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

/* The references the words are measured against: Still / Still with every
   dial at zero (PP_STANDARD_STILL), and ST with every dial at its default. */
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

type Wb = Recipe['whiteBalance'];
const pp = (patch: Partial<typeof PP.settings>, wb: Wb = PP.whiteBalance, id = PP.id) => ({
  ...PP,
  id,
  whiteBalance: wb,
  settings: { ...PP.settings, ...patch },
});
const cl = (patch: Partial<typeof CL.settings>, wb: Wb = CL.whiteBalance, id = CL.id) => ({
  ...CL,
  id,
  whiteBalance: wb,
  settings: { ...CL.settings, ...patch },
});
const words = (r: Recipe) => readName(r).words;
const kelvin = (k: number, shift?: Extract<Wb, { mode: 'kelvin' }>['shift']): Wb => ({ mode: 'kelvin', kelvin: k, shift });
const COLOUR_ORDER = ['Pale', 'Muted', 'Natural', 'Rich', 'Vivid'];

describe('the reading', () => {
  it('names a recipe at the reference Neutral Even Natural, in both formats', () => {
    expect(words(PP)).toEqual(['Neutral', 'Even', 'Natural']);
    expect(words(CL)).toEqual(['Neutral', 'Even', 'Natural']);
    expect(nameFor(PP)).toBe('PP-900-Neutral Even Natural');
  });

  it('grades the temperature off the palette, ends of the Kelvin range included', () => {
    expect(words(pp({}, kelvin(WB_KELVIN.max)))[0]).toBe('Golden');
    expect(words(pp({}, kelvin(6500)))[0]).toBe('Warm');
    expect(words(pp({}, kelvin(4500)))[0]).toBe('Cool');
    expect(words(pp({}, kelvin(WB_KELVIN.min)))[0]).toBe('Icy');
    expect(words(pp({}, kelvin(5500, { gm: { axis: 'M', amount: 4 } })))[0]).toBe('Rosy');
    expect(words(pp({}, kelvin(5500, { gm: { axis: 'G', amount: 4 } })))[0]).toBe('Mint');
    // Inside one shift step of neutral a shifted cast names no side (wbSummary's
    // rule); the same cast from a bare Kelvin does.
    expect(words(pp({}, kelvin(5500, { ab: { axis: 'B', amount: 0.75 } })))[0]).toBe('Neutral');
    expect(words(pp({}, kelvin(5100)))[0]).toBe('Cool');
    // A tint the amber–blue lean outweighs does not take the slot.
    expect(words(pp({}, kelvin(WB_KELVIN.max, { gm: { axis: 'M', amount: 1 } })))[0]).toBe('Golden');
  });

  it('leaves the colour word to the dials: a White Balance cast alone is Natural', () => {
    /* A cast lengthens some hues and shortens others; the reference is read
       under the same White Balance, so the cast cancels and only the
       temperature word names it. */
    for (const wb of [kelvin(WB_KELVIN.min), kelvin(WB_KELVIN.max), kelvin(5500, { gm: { axis: 'M', amount: WB_SHIFT_AXIS.max } })]) {
      expect(words(pp({}, wb))[2]).toBe('Natural');
      expect(words(cl({}, wb))[2]).toBe('Natural');
    }
  });

  it('names a monochrome recipe Mono or Sepia, and its detail instead of its colour', () => {
    expect(words(pp({ colorMode: 'Black & White', detail: { ...PP.settings.detail, level: 3 } }))).toEqual(['Mono', 'Even', 'Crisp']);
    expect(words(pp({ colorMode: 'Black & White', detail: { ...PP.settings.detail, level: -3 } }))[2]).toBe('Gentle');
    expect(words(pp({ colorMode: 'Black & White' }))[2]).toBe('Plain');
    expect(words(cl({ look: 'BW', saturation: undefined, sharpness: 0, clarity: 0 }))).toEqual(['Mono', 'Even', 'Gentle']);
    expect(words(cl({ look: 'SE', saturation: undefined, clarity: 7 }))).toEqual(['Sepia', 'Even', 'Crisp']);
    expect(words(cl({ look: 'SE', saturation: undefined, sharpness: 3 }))[2]).toBe('Plain');
  });

  it('reads the tonality off the neutral ramp, whatever dial moved it', () => {
    // The shadow lifted: Matte, strongly Faded; crushed: Deep.
    expect(words(pp({ blackLevel: 6 }))[1]).toBe('Matte');
    expect(words(cl({ fade: 2 }))[1]).toBe('Matte');
    expect(words(cl({ fade: CL_RANGES.fade.max, shadows: CL_RANGES.shadows.max }))[1]).toBe('Faded');
    expect(words(pp({ blackLevel: -6 }))[1]).toBe('Deep');
    expect(words(cl({ shadows: CL_RANGES.shadows.min }))[1]).toBe('Deep');
    // The spread widened: Punchy; narrowed: Soft, strongly Flat.
    expect(words(cl({ contrast: 5 }))[1]).toBe('Punchy');
    expect(words(cl({ highlights: CL_RANGES.highlights.max }))[1]).toBe('Punchy');
    expect(words(cl({ contrast: -5 }))[1]).toBe('Soft');
    expect(words(pp({ knee: { mode: 'Manual', point: 80, slope: -5 } }))[1]).toBe('Soft');
    expect(words(pp({ gamma: 'S-Log3', colorMode: 'S-Gamut3.Cine' }))[1]).toBe('Soft');
    expect(
      words(
        pp({
          gamma: 'S-Log3',
          colorMode: 'S-Gamut3.Cine',
          blackLevel: PP_RANGES.blackLevel.max,
          knee: { mode: 'Manual', point: PP_RANGES.kneeManualPoint.min, slope: PP_RANGES.kneeManualSlope.min },
        }),
      )[1],
    ).toBe('Flat');
    // The highlight lifted with the spread no wider: Airy.
    expect(words(cl({ highlights: CL_RANGES.highlights.max, shadows: 5 }))[1]).toBe('Airy');
    expect(words(cl({ look: 'SH' }))[1]).toBe('Airy');
  });

  it('reads each Creative Look’s own base, so Looks at zero no longer read alike', () => {
    const atZero = Object.fromEntries(
      CREATIVE_LOOK_CODES.filter((l) => l !== 'BW' && l !== 'SE').map((look) => [look, words(cl({ look })).join(' ')]),
    );
    expect(atZero.ST).toBe('Neutral Even Natural');
    expect(words(cl({ look: 'VV' }))[2]).toBe('Rich'); // VV raises chroma
    expect(words(cl({ look: 'NT' }))[2]).toBe('Muted'); // NT lowers it
    expect(words(cl({ look: 'FL' }))[1]).toBe('Deep'); // FL darkens the shadow
    expect(words(cl({ look: 'IN' }))[0]).toBe('Warm'); // IN lays its own warm cast
    expect(new Set(Object.values(atZero)).size).toBeGreaterThanOrEqual(6);
  });

  it('reads a Picture Profile’s gamma and colour mode against Still / Still', () => {
    expect(words(pp({ gamma: 'Cine4' }))[1]).toBe('Deep'); // Cine4 firms the dark end
    expect(words(pp({ gamma: 'Cine1', colorMode: 'Pro' }))[1]).toBe('Soft'); // Cine1 lifts it
    expect(words(pp({ colorMode: 'S-Gamut3.Cine' }))[2]).toBe('Muted');
    expect(words(pp({ gamma: 'S-Log3', colorMode: 'S-Gamut3.Cine' }))[2]).toBe('Pale');
  });

  it('grades the colour on each format’s own reach, monotonically in Saturation', () => {
    expect(words(pp({ saturation: PP_RANGES.saturation.max }))[2]).toBe('Vivid');
    expect(words(pp({ saturation: 4 }))[2]).toBe('Rich');
    expect(words(pp({ saturation: -8 }))[2]).toBe('Muted');
    expect(words(pp({ saturation: PP_RANGES.saturation.min }))[2]).toBe('Pale');
    expect(words(cl({ saturation: CL_RANGES.saturation.max }))[2]).toBe('Vivid');
    expect(words(cl({ saturation: CL_RANGES.saturation.min }))[2]).toBe('Pale');
    // One step either way is already a reading: 0 only at 0, as `step()` grades.
    expect(words(pp({ saturation: 1 }))[2]).toBe('Rich');
    expect(words(cl({ saturation: -1 }))[2]).toBe('Muted');
    for (const [make, range] of [
      [(s: number) => pp({ saturation: s }), PP_RANGES.saturation],
      [(s: number) => cl({ saturation: s }), CL_RANGES.saturation],
    ] as const) {
      let last = -1;
      for (let s = range.min; s <= range.max; s += 1) {
        const at = COLOUR_ORDER.indexOf(words(make(s))[2]);
        expect(at, `saturation ${s}`).toBeGreaterThanOrEqual(last);
        last = at;
      }
    }
  });

  it('offers only honest alternatives: each is a reading of its own', () => {
    // Detail is not painted, so it is never a slot word for a colour recipe — but it is a reading.
    expect(readName(cl({ sharpness: CL_RANGES.sharpness.max })).alternatives.map((a) => a.word)).toContain('Crisp');
    expect(readName(pp({ detail: { ...PP.settings.detail, level: -3 } })).alternatives.map((a) => a.word)).toContain('Gentle');
    expect(readName(pp({ blackLevel: 15 })).alternatives.map((a) => a.word)).toContain('Bright');
    expect(readName(pp({ blackLevel: -15 })).alternatives.map((a) => a.word)).toContain('Dark');
    // A tint word needs a G/M shift the palette shows: a strong blue cast alone is not Rosy.
    expect(readName(pp({}, kelvin(WB_KELVIN.min))).alternatives.map((a) => a.word)).not.toContain('Rosy');
    expect(readName(pp({}, kelvin(WB_KELVIN.max, { gm: { axis: 'M', amount: 2 } }))).alternatives.map((a) => a.word)).toContain('Rosy');
    // Nothing moved, nothing to offer.
    expect(readName(PP).alternatives).toEqual([]);
  });

  it('can produce every word of the vocabulary, and no other', () => {
    /* The ends of every range in constants.ts, through every gamma, colour
       mode and Look, under the Kelvin ends and a full shift each way. */
    const seen = new Set<string>();
    const note = (r: Recipe) => {
      const n = readName(r);
      for (const w of [...n.words, ...n.alternatives.map((a) => a.word)]) seen.add(w);
    };
    const wbs: Wb[] = [
      PP.whiteBalance,
      kelvin(WB_KELVIN.min),
      kelvin(WB_KELVIN.max),
      kelvin(5500, { gm: { axis: 'M', amount: WB_SHIFT_AXIS.max } }),
      kelvin(5500, { gm: { axis: 'G', amount: WB_SHIFT_AXIS.max } }),
    ];
    const ends = (r: { min: number; max: number }) => [r.min, 0, r.max];
    for (const wb of wbs) {
      for (const gamma of PP_GAMMA)
        for (const colorMode of PP_COLOR_MODE)
          for (const blackLevel of ends(PP_RANGES.blackLevel))
            for (const saturation of ends(PP_RANGES.saturation))
              note(pp({ gamma, colorMode, blackLevel, saturation, detail: { ...PP.settings.detail, level: blackLevel > 0 ? 7 : blackLevel < 0 ? -7 : 0 } }, wb));
      for (const look of CREATIVE_LOOK_CODES)
        for (const contrast of ends(CL_RANGES.contrast))
          for (const highlights of ends(CL_RANGES.highlights))
            for (const shadows of ends(CL_RANGES.shadows))
              for (const fade of [0, CL_RANGES.fade.max])
                for (const sharpness of [0, 3, CL_RANGES.sharpness.max]) {
                  const mono = look === 'BW' || look === 'SE';
                  note(cl({ look, contrast, highlights, shadows, fade, sharpness, saturation: mono ? undefined : contrast }, wb));
                }
    }
    expect([...seen].sort()).toEqual([...NAME_VOCABULARY].sort());
  });
});

describe('the tie-break', () => {
  it('replaces the least salient slot with the most salient honest alternative, whatever order the catalogue comes in', () => {
    const first = cl({}, CL.whiteBalance, 'CL-901');
    const second = cl({ sharpness: CL_RANGES.sharpness.max }, CL.whiteBalance, 'CL-902');
    const third = cl({ sharpness: CL_RANGES.sharpness.max, shadows: -4 }, CL.whiteBalance, 'CL-903');
    const names = namesFor([third, second, first]);
    expect(names.get('CL-901')).toBe('CL-901-Neutral Even Natural');
    // Even and Natural both read nothing; the colour slot goes first.
    expect(names.get('CL-902')).toBe('CL-902-Neutral Even Crisp');
    expect(names.get('CL-903')).toBe('CL-903-Neutral Deep Natural');
    expect(namesFor([first, second, third])).toEqual(names);
    expect(nameFor(third, [first, second])).toBe(names.get('CL-903'));
  });

  it('names Picture Profiles first, so a profile never yields its words to a Look by order', () => {
    expect(namesFor([cl({}, CL.whiteBalance, 'CL-001'), pp({}, PP.whiteBalance, 'PP-099')]).get('PP-099')).toBe(
      'PP-099-Neutral Even Natural',
    );
  });

  it('moves an earlier holder that has an alternative aside for a later recipe that has none', () => {
    const earlier = cl({ sharpness: CL_RANGES.sharpness.max }, CL.whiteBalance, 'CL-901');
    const later = cl({}, CL.whiteBalance, 'CL-902');
    const [a, b] = readNames([later, earlier]);
    expect(a).toMatchObject({ id: 'CL-901', words: ['Neutral', 'Even', 'Crisp'], yieldedTo: 'CL-902' });
    expect(b).toMatchObject({ id: 'CL-902', words: ['Neutral', 'Even', 'Natural'], tiedWith: null });
  });

  it('holds a combination as a set of words, so a reordering is a collision too', () => {
    expect(comboOf(['Neutral', 'Deep', 'Punchy'])).toBe(comboOf(['Neutral', 'Punchy', 'Deep']));
    expect(comboOf(['Neutral', 'Deep', 'Punchy'])).not.toBe(comboOf(['Warm', 'Deep', 'Punchy']));
  });

  it('reports a tie only between recipes that read alike', () => {
    const a = cl({}, { mode: 'preset', preset: 'Daylight' }, 'CL-901');
    const b = cl({}, { mode: 'auto', auto: 'AWB' }, 'CL-902');
    expect(readsAlike(a, b)).toBe(true);
    expect(readNames([a, b])[1]).toMatchObject({ id: 'CL-902', tiedWith: 'CL-901' });
    expect(readsAlike(a, cl({ contrast: 1 }, a.whiteBalance, 'CL-903'))).toBe(false);
    expect(readsAlike(a, cl({ sharpness: CL_RANGES.sharpness.max }, a.whiteBalance, 'CL-903'))).toBe(false);
  });
});

/* --------------------------------------------------------------------- */

describe('every recipe in the seed', () => {
  const results = readNames(seed);

  it('is named by nameFor, from its own settings', () => {
    const names = namesFor(seed);
    for (const r of seed) {
      expect(r.name, r.id).toBe(names.get(r.id));
      expect(r.name, r.id).toBe(nameFor(r, seed));
    }
  });

  it('is named PP-NNN or CL-NNN after its own id and format, in exactly three vocabulary words', () => {
    for (const r of seed) {
      const parsed = parseRecipeName(r.name);
      expect(parsed, `${r.id}: ${r.name}`).not.toBeNull();
      expect(parsed?.format, r.id).toBe(r.format);
      expect(parsed?.number, r.id).toBe(r.id.slice(-3));
      expect(parsed?.words, r.id).toHaveLength(3);
      for (const w of parsed?.words ?? []) expect(NAME_VOCABULARY.has(w), `${r.id}: ${w}`).toBe(true);
    }
    expect(new Set(seed.map((r) => r.name)).size).toBe(seed.length);
  });

  it('gives every recipe its code as its slug, so a name moves no URL', () => {
    for (const r of seed) expect(r.slug, r.id).toBe(slugFor(r.id));
  });

  it('holds three words no other recipe holds, in any order, except where two recipes read alike', () => {
    const holders = new Map<string, string[]>();
    for (const r of seed) {
      const combo = comboOf(wordsOf(r.name));
      holders.set(combo, [...(holders.get(combo) ?? []), r.id]);
    }
    const shared = [...holders.values()].filter((ids) => ids.length > 1);
    for (const ids of shared) {
      for (const id of ids.slice(1)) {
        expect(readsAlike(byId.get(ids[0])!, byId.get(id)!), `${ids.join(', ')} share words but not a palette`).toBe(true);
      }
    }
    /* The one pair today: Film at every dial's default under Daylight and
       under AWB — neither publishes a Kelvin, so their palettes are the same
       nine swatches, and both have Sharpness 4, Clarity 1. */
    expect(shared).toEqual([['CL-033', 'CL-034']]);
    expect(results.filter((n) => n.tiedWith).map((n) => [n.id, n.tiedWith])).toEqual([['CL-034', 'CL-033']]);
  });

  it('says every word honestly: the temperature as read, the other two from its own readings', () => {
    for (const n of results) {
      const r = byId.get(n.id)!;
      const [t, a, b] = wordsOf(r.name);
      expect(t, r.name).toBe(n.reading.words[0]);
      for (const [slot, w] of [[1, a], [2, b]] as const) {
        if (w === n.reading.words[slot]) continue;
        expect(n.replaced, `${r.name}: ${w} is not its reading`).toEqual({ slot, word: w });
        expect(n.reading.alternatives.map((x) => x.word), r.name).toContain(w);
      }
      for (const w of [a, b]) expect(n.reading.supported.has(w), `${r.name}: ${w}`).toBe(true);
    }
  });

  it('starts with a temperature word, or Mono or Sepia exactly when it is monochrome', () => {
    for (const r of seed) {
      const mono = monochromeOf(r);
      const first = wordsOf(r.name)[0];
      if (mono === 'bw') expect(first, r.id).toBe('Mono');
      else if (mono === 'sepia') expect(first, r.id).toBe('Sepia');
      else expect(TEMPERATURE_WORDS as readonly string[], r.id).toContain(first);
    }
  });

  it('takes its other two words from tonality, colour, detail, key and tint only', () => {
    const allowed = new Set<string>([...TONALITY_WORDS, ...COLOUR_WORDS, ...DETAIL_WORDS, ...KEY_WORDS, ...TINT_WORDS]);
    for (const r of seed) {
      const [, a, b] = wordsOf(r.name);
      expect(allowed.has(a) && allowed.has(b), r.name).toBe(true);
      expect(MONO_WORDS as readonly string[]).not.toContain(a);
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
      const warm = TONE_WORDS.warm.includes(w[0]);
      const cool = TONE_WORDS.cool.includes(w[0]);
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

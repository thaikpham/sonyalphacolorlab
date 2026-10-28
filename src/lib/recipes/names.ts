/**
 * Recipe names, computed from what the recipe's palette renders — never typed.
 *
 * `PP-048-Neutral Soft Rich`: the format, the id's three-digit number, then
 * exactly three words — temperature, tonality, colour. Design:
 * docs/superpowers/specs/2026-10-28-names-from-settings-design.md.
 *
 * The words read the palette (`paletteFor`), the same nine swatches the grid
 * draws beside the name, so they see everything the palette combines: the
 * White Balance under the light the recipe is built for, every dial, the
 * gamma and colour mode of a Picture Profile, a Creative Look's own base. Two
 * Looks with every dial at zero no longer read alike, because their palettes
 * do not.
 *
 * Each reading is a change from a reference palette of the same format — the
 * Still / Still pair the guide calls the rendering without a Picture Profile
 * (`PP_STANDARD_STILL`), or ST — with every dial at its default
 * (`defaults.ts`), graded as a fraction of the largest change the
 * palette can make in that direction for that format — found by evaluating it
 * at the range endpoints of `constants.ts` — with `effects.ts`'s 55% strong
 * cut. No magnitude lives here. No word names a place, a situation, a use, a
 * film stock, a Creative Look code, a brand or a person, and the whole string,
 * like every recipe name, is never translated (Rule 3).
 *
 * Reads the taxonomy manifest (the light a recipe is built for), so this is
 * for the seed emitter and the server, not a client bundle.
 */

import {
  CL_RANGES,
  CREATIVE_LOOK_CODES,
  PP_BLACK_GAMMA_RANGE,
  PP_COLOR_MODE,
  PP_GAMMA,
  PP_RANGES,
  PP_STANDARD_STILL,
  RECIPE_FORMATS,
  WB_AUTO_MODES,
  WB_SHIFT_AXIS,
} from '../camera/constants';
import {
  MIRED_PER_SHIFT_STEP,
  NEUTRAL_MIRED_BAND,
  WB_HUE,
  gradeWarmth,
  monochromeOf,
  type AccentInput,
  type Warmth,
} from '../camera/color';
import { DEFAULT_CL_SETTINGS, DEFAULT_PP_SETTINGS } from '../camera/defaults';
import { fraction, step, stepFromMin } from '../camera/effects';
import { DAYLIGHT_K, PALETTE_WEIGHTS, REFERENCE, SWATCH_IDS, paletteFor, type Palette } from '../camera/palette';
import type { ClSettings, PpSettings } from '../camera/schema';
import { recipeIdKey } from './recipe-id';
import type { ToneId } from './taxonomy';
import { designedLightFor } from './taxonomy-assign';

/** What a name is read from: the palette's input, plus the id for its number and designed light. */
export type NameInput = AccentInput & { readonly id: string };

/* ----------------------------------------------------------------------- */
/* The vocabulary — exactly the words `nameFor` can produce                 */
/* ----------------------------------------------------------------------- */

const WARMTH_WORDS: Readonly<Record<Warmth, string>> = {
  'strong-warm': 'Golden',
  warm: 'Warm',
  neutral: 'Neutral',
  cool: 'Cool',
  'strong-cool': 'Icy',
};

/** The tint words: the temperature slot when the tint dominates, a tie-break otherwise. */
export const TINT_WORDS = ['Rosy', 'Mint'] as const;
/** Slot 1 of a colour recipe: the amber–blue grade, or the tint when it dominates. */
export const TEMPERATURE_WORDS = [...Object.values(WARMTH_WORDS), ...TINT_WORDS] as const;
/** Slot 1 of a monochrome recipe. */
export const MONO_WORDS = ['Mono', 'Sepia'] as const;
/** Slot 2: what the neutral ramp does. Even when nothing on it moves. */
export const TONALITY_WORDS = ['Matte', 'Faded', 'Deep', 'Punchy', 'Soft', 'Flat', 'Airy', 'Even'] as const;
/** Slot 3 of a colour recipe, strong up to strong down. */
export const COLOUR_WORDS = ['Vivid', 'Rich', 'Natural', 'Muted', 'Pale'] as const;
/** Slot 3 of a monochrome recipe; Crisp and Gentle also break a tie. */
export const DETAIL_WORDS = ['Crisp', 'Plain', 'Gentle'] as const;
/** The key tie-break: the mid swatch against the reference's. */
export const KEY_WORDS = ['Bright', 'Dark'] as const;

/**
 * Closed by construction: every word above and nothing else. A new word is a
 * change to the reading below, never something a name slips in by itself.
 */
export const NAME_VOCABULARY: ReadonlySet<string> = new Set<string>([
  ...TEMPERATURE_WORDS,
  ...MONO_WORDS,
  ...TONALITY_WORDS,
  ...COLOUR_WORDS,
  ...DETAIL_WORDS,
  ...KEY_WORDS,
]);

/** `PP-048-Neutral Soft Rich`: format, three digits, exactly three Title Case words. */
export const RECIPE_NAME_RE = /^(PP|CL)-(\d{3})-([A-Z][a-z]+(?: [A-Z][a-z]+){2})$/;

/** The temperature words that claim a browse tone. Rosy and Mint claim none. */
export const TONE_WORDS: Readonly<Record<ToneId, readonly string[]>> = {
  warm: ['Golden', 'Warm'],
  cool: ['Cool', 'Icy'],
  mono: ['Mono', 'Sepia'],
  neutral: ['Neutral'],
};

/**
 * A recipe's slug: its code, lowercased — `PP-048` → `pp-048` (S1 of the
 * 2026-10-28 design). Never the name: names are computed from the settings
 * and may change whenever a grading does, and a URL must not move with them.
 * Either id shape gives the same slug (`SCL-PP-048` too).
 */
export function slugFor(id: string): string {
  return recipeIdKey(id).toLowerCase();
}

export function parseRecipeName(
  name: string,
): { format: 'pp' | 'cl'; number: string; words: string[] } | null {
  const m = RECIPE_NAME_RE.exec(name);
  if (!m) return null;
  return { format: m[1] === 'PP' ? 'pp' : 'cl', number: m[2], words: m[3].split(' ') };
}

/* ----------------------------------------------------------------------- */
/* Measuring a palette                                                      */
/* ----------------------------------------------------------------------- */

const RAD = Math.PI / 180;

/** The six hue swatches: the ones the reference gives a chroma. */
const HUE_SWATCHES = SWATCH_IDS.filter((id) => REFERENCE[id].c > 0);

/** What the words read off nine swatches: the neutral ramp, and the hues' mean chroma. */
type Measure = { shadow: number; mid: number; highlight: number; spread: number; chroma: number };
type Metric = keyof Measure;
const METRICS: readonly Metric[] = ['shadow', 'mid', 'highlight', 'spread', 'chroma'];

function measure(p: Palette): Measure {
  const at = (id: string) => p.find((s) => s.id === id)!;
  const [shadow, mid, highlight] = [at('shadow').l, at('mid').l, at('highlight').l];
  const chroma = HUE_SWATCHES.reduce((sum, id) => sum + at(id).c, 0) / HUE_SWATCHES.length;
  return { shadow, mid, highlight, spread: highlight - shadow, chroma };
}

/**
 * A change between two measures. The swatches are rounded (L to 0.001, C to
 * 0.0001), so anything finer is float noise from subtracting them — 0.89 −
 * 0.27 against 0.92 − 0.30 — and not a setting.
 */
const delta = (a: number, b: number) => Math.round((a - b) * 1e6) / 1e6;

/** No cast under any light: Auto publishes no Kelvin and there is no shift. */
const NO_CAST = { mode: 'auto', auto: WB_AUTO_MODES[0] } as const;

const ppInput = (settings: PpSettings): AccentInput => ({ format: 'pp', whiteBalance: NO_CAST, settings });
const clInput = (settings: ClSettings): AccentInput => ({ format: 'cl', whiteBalance: NO_CAST, settings });

type Format = (typeof RECIPE_FORMATS)[number];

/** The reference each recipe is read against: its format at the defaults, no cast. */
function referenceInput(format: Format): AccentInput {
  return format === 'pp'
    ? ppInput({ ...DEFAULT_PP_SETTINGS, ...PP_STANDARD_STILL })
    : clInput({ ...DEFAULT_CL_SETTINGS });
}

const ends = (r: { min: number; max: number }) => [r.min, r.max] as const;

/**
 * Every palette the reach is measured over: each format's enums in full and
 * each numeric dial at both ends of its `constants.ts` range. Monochrome
 * colour modes and Looks are left out — they have no colour to reach for,
 * and their tone is their colour sibling's.
 */
function endpointInputs(format: Format): AccentInput[] {
  const out: AccentInput[] = [];
  if (format === 'pp') {
    const base = { ...DEFAULT_PP_SETTINGS, ...PP_STANDARD_STILL };
    const knees: PpSettings['knee'][] = [
      { mode: 'Auto' },
      { mode: 'Manual', point: PP_RANGES.kneeManualPoint.min, slope: PP_RANGES.kneeManualSlope.min },
      { mode: 'Manual', point: PP_RANGES.kneeManualPoint.max, slope: PP_RANGES.kneeManualSlope.max },
    ];
    // Tone: the gamma, the two black controls and the knee.
    for (const gamma of PP_GAMMA)
      for (const blackLevel of ends(PP_RANGES.blackLevel))
        for (const range of PP_BLACK_GAMMA_RANGE)
          for (const level of ends(PP_RANGES.blackGammaLevel))
            for (const knee of knees)
              out.push(ppInput({ ...base, gamma, blackLevel, blackGamma: { range, level }, knee }));
    // Colour: the gamma's chroma, the colour mode, Saturation, Color Depth and Phase.
    for (const gamma of PP_GAMMA)
      for (const colorMode of PP_COLOR_MODE.filter((m) => m !== 'Black & White'))
        for (const saturation of ends(PP_RANGES.saturation))
          for (const depth of ends(PP_RANGES.colorDepth))
            for (const colorPhase of ends(PP_RANGES.colorPhase))
              out.push(
                ppInput({
                  ...base,
                  gamma,
                  colorMode,
                  saturation,
                  colorPhase,
                  colorDepth: { R: depth, G: depth, B: depth, C: depth, M: depth, Y: depth },
                }),
              );
    return out;
  }
  const base = DEFAULT_CL_SETTINGS;
  for (const look of CREATIVE_LOOK_CODES.filter((l) => l !== 'BW' && l !== 'SE'))
    for (const contrast of ends(CL_RANGES.contrast))
      for (const highlights of ends(CL_RANGES.highlights))
        for (const shadows of ends(CL_RANGES.shadows))
          for (const fade of ends(CL_RANGES.fade))
            for (const saturation of ends(CL_RANGES.saturation))
              out.push(clInput({ ...base, look, contrast, highlights, shadows, fade, saturation }));
  return out;
}

/** How far each metric can move from the reference, up and down, for one format. */
type Reach = Record<Metric, { up: number; down: number }>;

/** Everything a reading is measured against, per format: the reference with no cast, and the reach. */
type Scale = { reference: Measure; reach: Reach };

const scales = new Map<Format, Scale>();

/** The reference and the reach of one format, computed once. */
export function scaleFor(format: Format): Scale {
  const known = scales.get(format);
  if (known) return known;
  const reference = measure(paletteFor(referenceInput(format)));
  const reach = Object.fromEntries(METRICS.map((m) => [m, { up: 0, down: 0 }])) as Reach;
  for (const input of endpointInputs(format)) {
    const at = measure(paletteFor(input));
    for (const m of METRICS) {
      const d = delta(at[m], reference[m]);
      if (d > reach[m].up) reach[m].up = d;
      if (-d > reach[m].down) reach[m].down = -d;
    }
  }
  const scale = { reference, reach };
  scales.set(format, scale);
  return scale;
}

/** A change graded against the reach in its own direction, −1..1. */
function graded(d: number, reach: { up: number; down: number }): number {
  if (d === 0) return 0;
  const span = d > 0 ? reach.up : reach.down;
  return span === 0 ? 0 : Math.max(-1, Math.min(1, d / span));
}

/** `effects.ts`'s strong cut: past 55% of the way to the bound. */
const STRONG = 0.55;
const isStrong = (f: number) => Math.abs(f) >= STRONG;

/* ----------------------------------------------------------------------- */
/* The readings                                                             */
/* ----------------------------------------------------------------------- */

/** A word, and how salient the reading behind it is, 0..1. */
export type Candidate = { readonly word: string; readonly salience: number; readonly from: string };

/** The highest salience; ties go to the first listed. */
const bySalience = (list: readonly Candidate[]): Candidate[] =>
  list
    .map((c, i) => ({ c, i }))
    .sort((a, b) => b.c.salience - a.c.salience || a.i - b.i)
    .map(({ c }) => c);

const designedLight = (r: NameInput) => designedLightFor(r.id) ?? undefined;
const designedPalette = (r: NameInput) => paletteFor(r, { light: designedLight(r) });

/**
 * The palette's mid swatch, read under the light the recipe is built for, as
 * mireds on each White Balance axis: its projection on the amber (65) and
 * magenta (328) hues, turned back through the palette's own cast scale. The
 * mid is the neutral that carries the White Balance cast purest, and it is
 * the swatch a reader sees in the grid beside the name.
 */
export function paletteCast(r: NameInput): { warmth: number; tint: number } {
  return castOf(designedPalette(r));
}

function castOf(palette: Palette): { warmth: number; tint: number } {
  const mid = palette.find((s) => s.id === 'mid')!;
  const { chroma, miredScale } = PALETTE_WEIGHTS.cast;
  const mired = (hue: number) => ((mid.c * Math.cos((mid.h - hue) * RAD)) / chroma) * miredScale;
  return { warmth: mired(WB_HUE.amber), tint: mired(WB_HUE.magenta) };
}

/**
 * The neutral band on one axis: `gradeWarmth`'s, widened to one shift step
 * while the recipe sets a shift on that axis — the White Balance summary's
 * rule (`wbSummary`), because the mired value of a step is fitted, not
 * published, and a name inside one step of neutral would be inventing a side.
 */
const bandFor = (amount: number | undefined) => (amount ? MIRED_PER_SHIFT_STEP : NEUTRAL_MIRED_BAND);

/**
 * Slot 1. Mono or Sepia for a monochrome recipe; otherwise the amber–blue
 * grade, unless the green–magenta lean is larger by more than its own
 * neutral band — then Rosy or Mint.
 */
function temperature(r: NameInput, cast: { warmth: number; tint: number }): string {
  const mono = monochromeOf(r);
  if (mono) return mono === 'bw' ? 'Mono' : 'Sepia';
  const shift = r.whiteBalance.shift;
  const margin = Math.abs(cast.tint) - Math.abs(cast.warmth);
  if (margin >= bandFor(shift?.gm?.amount)) return cast.tint > 0 ? 'Rosy' : 'Mint';
  if (Math.abs(cast.warmth) < bandFor(shift?.ab?.amount)) return 'Neutral';
  return WARMTH_WORDS[gradeWarmth(cast.warmth)];
}

const signed = (d: number) => `${d >= 0 ? '+' : ''}${d.toFixed(3)}`;

/**
 * Slot 2's readings, off the neutral ramp against the reference's:
 * the shadow lifted (Matte, strong Faded) or crushed (Deep); the spread from
 * shadow to highlight widened (Punchy) or narrowed (Soft, strong Flat); the
 * highlight lifted while the spread did not widen (Airy). Unordered.
 */
function tonalityReadings(m: Measure, scale: Scale): Candidate[] {
  const { reference: ref, reach } = scale;
  const out: Candidate[] = [];
  const dS = delta(m.shadow, ref.shadow);
  const dSp = delta(m.spread, ref.spread);
  const dH = delta(m.highlight, ref.highlight);
  const fS = graded(dS, reach.shadow);
  const fSp = graded(dSp, reach.spread);
  if (fS > 0) out.push({ word: isStrong(fS) ? 'Faded' : 'Matte', salience: fS, from: `shadow ${signed(dS)}` });
  if (fS < 0) out.push({ word: 'Deep', salience: -fS, from: `shadow ${signed(dS)}` });
  if (fSp > 0) out.push({ word: 'Punchy', salience: fSp, from: `spread ${signed(dSp)}` });
  if (fSp < 0) out.push({ word: isStrong(fSp) ? 'Flat' : 'Soft', salience: -fSp, from: `spread ${signed(dSp)}` });
  const fH = graded(dH, reach.highlight);
  if (fH > 0 && dSp <= 0) out.push({ word: 'Airy', salience: fH, from: `highlight ${signed(dH)}, spread ${signed(dSp)}` });
  return out;
}

const COLOUR_BY_GRADE = (f: number) =>
  f === 0 ? 'Natural' : f > 0 ? (isStrong(f) ? 'Vivid' : 'Rich') : isStrong(f) ? 'Pale' : 'Muted';

/**
 * Slot 3 of a colour recipe: the six hues' mean chroma against the
 * reference's under the same White Balance and light, graded on the reach.
 * A cast lengthens some hues and shortens others, so against a reference
 * without it a Kelvin alone read Rich or Muted; the cast is the temperature
 * word's to name, and here it cancels.
 */
function colourReading(r: NameInput, m: Measure, scale: Scale): Candidate {
  const reference = measure(
    paletteFor({ ...referenceInput(r.format), whiteBalance: r.whiteBalance }, { light: designedLight(r) }),
  );
  const d = delta(m.chroma, reference.chroma);
  const f = graded(d, scale.reach.chroma);
  return { word: COLOUR_BY_GRADE(f), salience: Math.abs(f), from: `chroma ${signed(d)}` };
}

/**
 * The detail reading — the one thing the palette cannot paint (a flat patch
 * has no edge to sharpen): Picture Profile Detail Level graded around 0; for a
 * Creative Look the larger of Sharpness and Clarity graded from the minimum,
 * as their effect rows are — strong Crisp, mild Plain, both at none Gentle.
 */
function detailReading(r: NameInput): Candidate {
  if (r.format === 'pp') {
    const level = r.settings.detail.level;
    const f = fraction(level, PP_RANGES.detailLevel);
    const s = step(level, PP_RANGES.detailLevel);
    return { word: s > 0 ? 'Crisp' : s < 0 ? 'Gentle' : 'Plain', salience: Math.abs(f), from: `detail ${level}` };
  }
  const { sharpness, clarity } = r.settings;
  const s = Math.max(stepFromMin(sharpness, CL_RANGES.sharpness), stepFromMin(clarity, CL_RANGES.clarity));
  const d = Math.max(fraction(sharpness, CL_RANGES.sharpness), fraction(clarity, CL_RANGES.clarity));
  const from = `sharpness ${sharpness}, clarity ${clarity}`;
  if (s === 2) return { word: 'Crisp', salience: d, from };
  if (s === 0) return { word: 'Gentle', salience: 1, from };
  return { word: 'Plain', salience: 0, from };
}

/** The palette tint a full G/M shift reaches, under daylight: the tint word's scale. */
let tintReach: number | undefined;
function fullTint(): number {
  if (tintReach === undefined) {
    const whiteBalance = {
      mode: 'kelvin',
      kelvin: DAYLIGHT_K,
      shift: { gm: { axis: 'M', amount: WB_SHIFT_AXIS.max } },
    } as const;
    tintReach = Math.abs(castOf(paletteFor({ ...referenceInput('pp'), whiteBalance })).tint);
  }
  return tintReach;
}

/**
 * The tie-break readings, each honest on its own: the key — the mid swatch
 * against the reference's (Bright, Dark); the detail (Crisp, Gentle); the
 * tint — a G/M shift the recipe sets, where the palette's green–magenta lean
 * goes its way past its own neutral band (Rosy, Mint). The shift is required:
 * the amber and blue hues are not opposite the magenta one, so a strong
 * amber–blue cast alone projects onto that axis and would read as a tint it
 * does not have.
 */
function tieBreakReadings(r: NameInput, m: Measure, scale: Scale, cast: { tint: number }): Candidate[] {
  const out: Candidate[] = [];
  const dM = delta(m.mid, scale.reference.mid);
  const fM = graded(dM, scale.reach.mid);
  if (fM !== 0) out.push({ word: fM > 0 ? 'Bright' : 'Dark', salience: Math.abs(fM), from: `mid ${signed(dM)}` });
  const detail = detailReading(r);
  if (detail.word !== 'Plain' && detail.salience > 0) out.push(detail);
  const gm = r.whiteBalance.shift?.gm;
  const towards = gm?.axis === 'M' ? 1 : -1;
  if (gm && gm.amount > 0 && cast.tint * towards >= bandFor(gm.amount)) {
    out.push({
      word: cast.tint > 0 ? 'Rosy' : 'Mint',
      salience: Math.min(1, Math.abs(cast.tint) / fullTint()),
      from: `tint ${cast.tint.toFixed(1)} mired`,
    });
  }
  return out;
}

/** Everything that decided a recipe's words, for the tests, the tie-break and a reviewer. */
export type NameReading = {
  /** Temperature, tonality, colour (or detail), before any tie-break. */
  readonly words: readonly [string, string, string];
  readonly cast: { readonly warmth: number; readonly tint: number };
  /** Slot 2 and 3 as read, with their salience — the tie-break replaces the lower. */
  readonly slots: readonly [Candidate, Candidate];
  /**
   * Every honest word a tie-break may use, most salient first: the tonality
   * readings slot 2 did not take, then key, detail and tint.
   */
  readonly alternatives: readonly Candidate[];
  /** Every word this recipe's readings support, in any slot. */
  readonly supported: ReadonlySet<string>;
};

const EVEN: Candidate = { word: 'Even', salience: 0, from: 'ramp as the reference' };

export function readName(r: NameInput): NameReading {
  const palette = designedPalette(r);
  const scale = scaleFor(r.format);
  const m = measure(palette);
  const cast = castOf(palette);
  const tonal = bySalience(tonalityReadings(m, scale));
  const tonality = tonal[0] ?? EVEN;
  const mono = monochromeOf(r) !== null;
  const third = mono ? detailReading(r) : colourReading(r, m, scale);
  const first = temperature(r, cast);
  const taken = [first, tonality.word, third.word];
  const alternatives = bySalience([...tonal.slice(1), ...tieBreakReadings(r, m, scale, cast)]).filter(
    (c, i, all) => !taken.includes(c.word) && all.findIndex((o) => o.word === c.word) === i,
  );
  return {
    words: [first, tonality.word, third.word],
    cast,
    slots: [tonality, third],
    alternatives,
    supported: new Set([first, tonality.word, third.word, ...alternatives.map((a) => a.word)]),
  };
}

const codeOf = (r: NameInput) => `${r.format.toUpperCase()}-${r.id.slice(-3)}`;

/** A recipe's three words, and why, after the tie-break. */
export type NameResult = {
  readonly id: string;
  readonly words: readonly [string, string, string];
  readonly reading: NameReading;
  /** The slot a tie-break replaced (1 tonality, 2 colour), and the word it took. */
  readonly replaced: { readonly slot: 1 | 2; readonly word: string } | null;
  /** The later recipe that took the words this one held before it moved aside. */
  readonly yieldedTo: string | null;
  /** The recipe holding the same three words when no honest alternative was left. */
  readonly tiedWith: string | null;
};

type Words = readonly [string, string, string];
type Option = { readonly words: Words; readonly replaced: NameResult['replaced'] };

/**
 * Two names with the same words in another order read as one ("Neutral Deep
 * Punchy", "Neutral Punchy Deep"), so a combination is held as a set.
 */
export const comboOf = (w: readonly string[]) => [w[0], ...[...w.slice(1)].sort()].join(' ');

/**
 * What a recipe may be called, in preference order: its own three words,
 * then each honest alternative in its least salient slot — tonality or
 * colour, never the temperature — most salient first, then the same in the
 * other slot. Every option is honest: each word is one of the recipe's own
 * readings.
 */
function optionsOf(reading: NameReading): Option[] {
  const words = reading.words;
  const [tonality, third] = reading.slots;
  const slots: (1 | 2)[] = third.salience <= tonality.salience ? [2, 1] : [1, 2];
  const out: Option[] = [{ words, replaced: null }];
  const seen = new Set([comboOf(words)]);
  for (const slot of slots) {
    for (const alt of reading.alternatives) {
      const next = [...words] as [string, string, string];
      next[slot] = alt.word;
      if (seen.has(comboOf(next))) continue;
      seen.add(comboOf(next));
      out.push({ words: next, replaced: { slot, word: alt.word } });
    }
  }
  return out;
}

/** Picture Profile first, then by number: the order recipes are named in. */
export function namingOrder<T extends NameInput>(recipes: readonly T[]): T[] {
  return [...recipes].sort(
    (a, b) =>
      RECIPE_FORMATS.indexOf(a.format) - RECIPE_FORMATS.indexOf(b.format) || a.id.slice(-3).localeCompare(b.id.slice(-3)),
  );
}

/**
 * Every recipe's words, Picture Profile first, then by number.
 *
 * Each recipe takes its first option no earlier recipe holds — its own three
 * words, or, when they are held in any order, the most salient honest
 * alternative in its least salient slot (`optionsOf`). When every option is
 * held, an earlier holder moves to an option of its own that is free, or that
 * it can free the same way — the shortest honest re-route, searched in the
 * later recipe's order of preference — so a recipe whose readings allow only
 * a few names is not left without one because an earlier recipe with more to
 * choose from took them. With no re-route either, the recipe keeps its own
 * words and names the recipe it ties with: no word this vocabulary can say
 * tells their palettes apart.
 */
export function readNames(recipes: readonly NameInput[]): NameResult[] {
  const order = namingOrder(recipes);
  const readings = order.map(readName);
  const options = readings.map(optionsOf);
  const choice: number[] = order.map(() => -1);
  const yieldedTo: (string | null)[] = order.map(() => null);
  /** Combination → index of the recipe holding it. */
  const holder = new Map<string, number>();

  const take = (i: number, k: number) => {
    choice[i] = k;
    holder.set(comboOf(options[i][k].words), i);
  };

  /** Find recipe `i` a free option, re-routing holders where needed; `visited` bounds the search. */
  const place = (i: number, visited: Set<string>): boolean => {
    for (const [k, option] of options[i].entries()) {
      const combo = comboOf(option.words);
      if (!holder.has(combo) && !visited.has(combo)) {
        take(i, k);
        return true;
      }
    }
    for (const [k, option] of options[i].entries()) {
      const combo = comboOf(option.words);
      if (visited.has(combo)) continue;
      visited.add(combo);
      const h = holder.get(combo);
      if (h === undefined || h === i) continue;
      if (place(h, visited)) {
        yieldedTo[h] = order[i].id;
        take(i, k);
        return true;
      }
    }
    return false;
  };

  const unplaced = new Set<number>();
  for (let i = 0; i < order.length; i += 1) if (!place(i, new Set())) unplaced.add(i);

  return order.map((r, i) => {
    if (unplaced.has(i)) {
      const words = readings[i].words;
      const tie = holder.get(comboOf(words))!;
      return { id: r.id, words, reading: readings[i], replaced: null, yieldedTo: null, tiedWith: order[tie].id };
    }
    const { words, replaced } = options[i][choice[i]];
    return { id: r.id, words, reading: readings[i], replaced, yieldedTo: yieldedTo[i], tiedWith: null };
  });
}

/**
 * Two recipes a name cannot tell apart: the same nine swatches under the
 * light each is built for, and the same detail reading — the one thing the
 * palette does not paint. A tie between two such recipes is the truth (they
 * render alike); a tie between any others is a defect in the reading.
 */
export function readsAlike(a: NameInput, b: NameInput): boolean {
  const swatches = (r: NameInput) => JSON.stringify(designedPalette(r).map(({ l, c, h }) => [l, c, h]));
  return a.format === b.format && swatches(a) === swatches(b) && detailReading(a).word === detailReading(b).word;
}

/** Every recipe's name, keyed by id. */
export function namesFor(recipes: readonly NameInput[]): Map<string, string> {
  const byId = new Map(recipes.map((r) => [r.id, r]));
  return new Map(readNames(recipes).map((n) => [n.id, `${codeOf(byId.get(n.id)!)}-${n.words.join(' ')}`]));
}

/**
 * One recipe's name among `catalogue` (the recipes it must not read the same
 * as; itself by default). The seed names every recipe with the whole seed;
 * /admin names a recipe with the published catalogue.
 */
export function nameFor(recipe: NameInput, catalogue: readonly NameInput[] = [recipe]): string {
  const all = [...catalogue.filter((r) => r.id !== recipe.id), recipe];
  return namesFor(all).get(recipe.id)!;
}

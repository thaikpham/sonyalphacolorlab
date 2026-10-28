/**
 * Recipe names, computed from the recipe's own settings — never typed.
 *
 * `PP-048-Neutral Soft Rich`: the format, the id's three-digit number, then
 * three words read off the White Balance and the Picture Profile or Creative
 * Look, in a fixed order — temperature, tonality, colour — and a fourth only
 * to tell two recipes apart. Design:
 * docs/superpowers/specs/2026-10-28-names-from-settings-design.md.
 *
 * Every word is graded with a measure the rest of the app already shows, so a
 * name cannot contradict the palette, the effect rows or the White Balance
 * summary beside it: the temperature is the palette's mid swatch graded by
 * `gradeWarmth`, the tonality and colour are `fraction()` and the step
 * grading of `effects.ts`. No threshold lives here. No word names a place, a
 * situation, a use, a film stock, a Creative Look code, a brand or a person,
 * and the whole string, like every recipe name, is never translated (Rule 3).
 *
 * Reads the taxonomy manifest (the light a recipe is built for), so this is
 * for the seed emitter and the server, not a client bundle.
 */

import {
  CL_RANGES,
  PP_FLAT_GAMMA,
  PP_COLOR_DEPTH_CHANNELS,
  PP_RANGES,
  RECIPE_FORMATS,
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
import { fraction, step, stepFromMin, stepOfFraction, type Step } from '../camera/effects';
import { PALETTE_WEIGHTS, kneeCompression, paletteFor } from '../camera/palette';
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

/** Slot 1 of a colour recipe: the amber–blue grade, or the tint when it dominates. */
export const TEMPERATURE_WORDS = [...Object.values(WARMTH_WORDS), 'Rosy', 'Mint'] as const;
/** Slot 1 of a monochrome recipe. */
export const MONO_WORDS = ['Mono', 'Sepia'] as const;
/** Slot 2. */
export const TONALITY_WORDS = ['Flat', 'Matte', 'Deep', 'Soft', 'Punchy', 'Faded', 'Airy', 'Even'] as const;
/** Slot 3 of a colour recipe, strong up to strong down. */
export const COLOUR_WORDS = ['Vivid', 'Rich', 'Natural', 'Muted', 'Pale'] as const;
/** Slot 3 of a monochrome recipe, and the detail tie-break. */
export const DETAIL_WORDS = ['Crisp', 'Plain', 'Gentle'] as const;
/** The key tie-break. */
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

/** `PP-048-Neutral Soft Rich`: format, three digits, three or four Title Case words. */
export const RECIPE_NAME_RE = /^(PP|CL)-(\d{3})-([A-Z][a-z]+(?: [A-Z][a-z]+){2,3})$/;

/** The temperature words that claim a browse tone. Rosy and Mint claim none. */
export const TONE_WORDS: Readonly<Record<ToneId, readonly string[]>> = {
  warm: ['Golden', 'Warm'],
  cool: ['Cool', 'Icy'],
  mono: ['Mono', 'Sepia'],
  neutral: ['Neutral'],
};

/**
 * The slug a name gives: `PP-048-Soft Clean Portrait` →
 * `pp-048-soft-clean-portrait`. Names are ASCII by construction, so
 * lower-casing and joining every run of anything else with one hyphen is the
 * whole rule.
 */
export function slugFor(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function parseRecipeName(
  name: string,
): { format: 'pp' | 'cl'; number: string; words: string[] } | null {
  const m = RECIPE_NAME_RE.exec(name);
  if (!m) return null;
  return { format: m[1] === 'PP' ? 'pp' : 'cl', number: m[2], words: m[3].split(' ') };
}

/* ----------------------------------------------------------------------- */
/* The reading                                                              */
/* ----------------------------------------------------------------------- */

const RAD = Math.PI / 180;

/** A word and how far along its own range the setting behind it sits, 0..1 (Black Gamma Wide may reach 1.3). */
type Candidate = { readonly word: string; readonly salience: number; readonly from: string };

/** Float noise from summing two fractions is not a setting. */
const exact = (f: number) => (Math.abs(f) < 1e-9 ? 0 : f);

/** The highest salience; ties go to the first listed. */
const mostSalient = (list: readonly Candidate[]): Candidate | undefined =>
  list.reduce<Candidate | undefined>((best, c) => (!best || c.salience > best.salience ? c : best), undefined);

/**
 * The palette's mid swatch, read under the light the recipe is built for, as
 * mireds on each White Balance axis: its projection on the amber (65) and
 * magenta (328) hues, turned back through the palette's own cast scale. The
 * mid is the neutral that carries the White Balance cast purest, and it is
 * the swatch a reader sees in the grid beside the name.
 */
export function paletteCast(r: NameInput): { warmth: number; tint: number } {
  const mid = paletteFor(r, { light: designedLightFor(r.id) ?? undefined }).find((s) => s.id === 'mid')!;
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

/** Slot 2's candidates: every contrast-axis setting that moves, with the word it moves towards. */
function tonalityCandidates(r: NameInput): Candidate[] {
  const out: Candidate[] = [];
  const push = (word: string, signed: number, from: string) => {
    if (signed !== 0) out.push({ word, salience: Math.abs(signed), from });
  };
  if (r.format === 'pp') {
    const s = r.settings;
    if ((PP_FLAT_GAMMA as readonly string[]).includes(s.gamma)) out.push({ word: 'Flat', salience: 1, from: `gamma ${s.gamma}` });
    const bl = fraction(s.blackLevel, PP_RANGES.blackLevel);
    push(bl > 0 ? 'Matte' : 'Deep', bl, `black level ${s.blackLevel}`);
    const bg =
      fraction(s.blackGamma.level, PP_RANGES.blackGammaLevel) * PALETTE_WEIGHTS.blackGamma.reach[s.blackGamma.range];
    push(bg > 0 ? 'Matte' : 'Deep', bg, `black gamma ${s.blackGamma.range} ${s.blackGamma.level}`);
    const knee = kneeCompression(s);
    if (s.knee.mode === 'Manual') push('Soft', knee, `knee ${s.knee.point}% ${s.knee.slope}`);
    return out;
  }
  const s = r.settings;
  const contrast = fraction(s.contrast, CL_RANGES.contrast);
  push(contrast > 0 ? 'Punchy' : 'Soft', contrast, `contrast ${s.contrast}`);
  const fade = stepFromMin(s.fade, CL_RANGES.fade);
  if (fade > 0) push(fade === 2 ? 'Faded' : 'Matte', fraction(s.fade, CL_RANGES.fade), `fade ${s.fade}`);
  if (step(s.highlights, CL_RANGES.highlights) === 2) {
    push('Airy', fraction(s.highlights, CL_RANGES.highlights), `highlights ${s.highlights}`);
  }
  if (step(s.shadows, CL_RANGES.shadows) === -2) {
    push('Deep', fraction(s.shadows, CL_RANGES.shadows), `shadows ${s.shadows}`);
  }
  return out;
}

const COLOUR_BY_STEP: Readonly<Record<Step, string>> = { 2: 'Vivid', 1: 'Rich', 0: 'Natural', [-1]: 'Muted', [-2]: 'Pale' };

/**
 * Slot 3 of a colour recipe: Saturation's fraction, plus a Picture Profile's
 * mean Color Depth as a fraction of its range (Color Depth plus deepens every
 * hue it reaches), clamped and graded as `step()` grades one dial.
 */
function colourReading(r: NameInput): { word: string; fraction: number } {
  let f: number;
  if (r.format === 'pp') {
    const s = r.settings;
    const mean = PP_COLOR_DEPTH_CHANNELS.reduce((sum, c) => sum + s.colorDepth[c], 0) / PP_COLOR_DEPTH_CHANNELS.length;
    f = fraction(s.saturation, PP_RANGES.saturation) + fraction(mean, PP_RANGES.colorDepth);
  } else {
    f = fraction(r.settings.saturation ?? 0, CL_RANGES.saturation);
  }
  f = exact(Math.max(-1, Math.min(1, f)));
  return { word: COLOUR_BY_STEP[stepOfFraction(f)], fraction: f };
}

/**
 * The detail reading: Picture Profile Detail Level graded around 0; for a
 * Creative Look the larger of Sharpness and Clarity graded from the minimum,
 * as their effect rows are — strong Crisp, mild Plain, both at none Gentle.
 */
function detailReading(r: NameInput): { word: string; salience: number } {
  if (r.format === 'pp') {
    const level = r.settings.detail.level;
    const f = fraction(level, PP_RANGES.detailLevel);
    const s = step(level, PP_RANGES.detailLevel);
    return { word: s > 0 ? 'Crisp' : s < 0 ? 'Gentle' : 'Plain', salience: Math.abs(f) };
  }
  const { sharpness, clarity } = r.settings;
  const s = Math.max(stepFromMin(sharpness, CL_RANGES.sharpness), stepFromMin(clarity, CL_RANGES.clarity));
  const d = Math.max(fraction(sharpness, CL_RANGES.sharpness), fraction(clarity, CL_RANGES.clarity));
  if (s === 2) return { word: 'Crisp', salience: d };
  if (s === 0) return { word: 'Gentle', salience: 1 };
  return { word: 'Plain', salience: 0 };
}

/** The tie-break's descriptors, in their listed order. Plain is not a descriptor. */
function descriptors(r: NameInput): Candidate[] {
  const out: Candidate[] = [];
  const detail = detailReading(r);
  if (detail.word !== 'Plain' && detail.salience > 0) out.push({ ...detail, from: 'detail' });

  const keys: { f: number; from: string }[] =
    r.format === 'pp'
      ? [{ f: fraction(r.settings.blackLevel, PP_RANGES.blackLevel), from: `black level ${r.settings.blackLevel}` }]
      : [
          { f: fraction(r.settings.highlights, CL_RANGES.highlights), from: `highlights ${r.settings.highlights}` },
          { f: fraction(r.settings.shadows, CL_RANGES.shadows), from: `shadows ${r.settings.shadows}` },
        ];
  const key = keys.reduce((best, k) => (Math.abs(k.f) > Math.abs(best.f) ? k : best));
  if (key.f !== 0) out.push({ word: key.f > 0 ? 'Bright' : 'Dark', salience: Math.abs(key.f), from: key.from });

  const gm = r.whiteBalance.shift?.gm;
  if (gm && gm.amount > 0) {
    out.push({ word: gm.axis === 'M' ? 'Rosy' : 'Mint', salience: fraction(gm.amount, WB_SHIFT_AXIS), from: `shift ${gm.axis}${gm.amount}` });
  }
  return out;
}

/** Everything that decided a recipe's three words, for the tests and for a reviewer. */
export type NameReading = {
  readonly words: readonly [string, string, string];
  readonly cast: { readonly warmth: number; readonly tint: number };
  readonly tonality: Candidate | null;
  readonly colour: { readonly word: string; readonly fraction: number } | null;
  readonly detail: { readonly word: string; readonly salience: number } | null;
  readonly descriptors: readonly Candidate[];
};

export function readName(r: NameInput): NameReading {
  const cast = paletteCast(r);
  const tonality = mostSalient(tonalityCandidates(r)) ?? null;
  const mono = monochromeOf(r) !== null;
  const colour = mono ? null : colourReading(r);
  const detail = mono ? detailReading(r) : null;
  return {
    words: [temperature(r, cast), tonality?.word ?? 'Even', colour?.word ?? detail!.word],
    cast,
    tonality,
    colour,
    detail,
    descriptors: [...descriptors(r)].sort((a, b) => b.salience - a.salience),
  };
}

const codeOf = (r: NameInput) => `${r.format.toUpperCase()}-${r.id.slice(-3)}`;

/**
 * Every recipe's name, in one pass: Picture Profile first, then by number.
 * A recipe whose three words an earlier one already has takes a fourth —
 * the most salient descriptor not in its name whose four words nobody
 * earlier holds. With none left, it keeps three: the code is unique.
 */
export function namesFor(recipes: readonly NameInput[]): Map<string, string> {
  const order = [...recipes].sort(
    (a, b) =>
      RECIPE_FORMATS.indexOf(a.format) - RECIPE_FORMATS.indexOf(b.format) || a.id.slice(-3).localeCompare(b.id.slice(-3)),
  );
  const bases = new Set<string>();
  const fulls = new Set<string>();
  const names = new Map<string, string>();
  for (const r of order) {
    const reading = readName(r);
    const base = reading.words.join(' ');
    let words: readonly string[] = reading.words;
    if (bases.has(base)) {
      const extra = reading.descriptors.find(
        (d) => !reading.words.includes(d.word) && !fulls.has(`${base} ${d.word}`),
      );
      if (extra) words = [...reading.words, extra.word];
    }
    bases.add(base);
    fulls.add(words.join(' '));
    names.set(r.id, `${codeOf(r)}-${words.join(' ')}`);
  }
  return names;
}

/**
 * One recipe's name among `catalogue` (the recipes it must not read the same
 * as; itself by default). The seed names every recipe with the whole seed.
 */
export function nameFor(recipe: NameInput, catalogue: readonly NameInput[] = [recipe]): string {
  const all = [...catalogue.filter((r) => r.id !== recipe.id), recipe];
  return namesFor(all).get(recipe.id)!;
}

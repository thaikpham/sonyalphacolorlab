/**
 * A recipe's palette: nine swatches graded by its own settings.
 *
 * WHAT IT IS. A reading of the White Balance and either the Picture Profile or
 * the Creative Look, each moved in the direction Sony documents for it (Help
 * Guide for Creators TP0000909106–112, TP1000756714, the pages `constants.ts`
 * cites): Black Level plus weakens black, Black Gamma Narrow stays near black
 * and Wide reaches into grey, Knee from a lower point with a gentler slope
 * compresses more and slope +5 is off, Knee Auto acts on Movie and ITU709
 * only, Color Depth plus darkens and deepens a hue and does nothing to an
 * achromatic, Color Phase rotates every hue, Black & White has no chroma.
 * Three neutrals (highlight, mid, shadow) carry tone; six hues (red, skin,
 * yellow, foliage, sky, blossom) carry colour.
 *
 * WHAT IT IS NOT. A preview of what the camera records. The directions and
 * the order between recipes are sourced; every magnitude is a neutral
 * default. Never present it as a render, and never compute a camera value
 * from it — same contract as `accentFor`.
 *
 * WHAT IT LEAVES OUT. Detail, Sharpness, Sharpness Range and Clarity: a flat
 * patch has no edge to sharpen. And the Kelvin a preset or AWB mode picks:
 * Sony publishes none (Rule 1), so only their shift paints.
 *
 * `PALETTE_WEIGHTS` holds every magnitude, to be refit from the a7 IV
 * ColorChecker shoot. The tests pin direction, order and legibility bands,
 * not numbers, so a refit does not fight them.
 */

import {
  CL_RANGES,
  PP_COLOR_DEPTH_CHANNELS,
  PP_KNEE_AUTO_GAMMA,
  PP_RANGES,
  type CreativeLookCode,
} from './constants';
import { CHANNEL_HUE, WB_HUE, gamutMap, monochromeOf, oklchToHex, wbBalance, type AccentInput } from './color';
import { fraction } from './effects';
import type { ClSettings, PpSettings } from './schema';

export const SWATCH_IDS = ['highlight', 'mid', 'shadow', 'red', 'skin', 'yellow', 'foliage', 'sky', 'blossom'] as const;
export type SwatchId = (typeof SWATCH_IDS)[number];

/** A swatch after every transform and the sRGB gamut map. `css` and `hex` come from the same mapped value. */
export type Swatch = {
  readonly id: SwatchId;
  readonly l: number;
  readonly c: number;
  readonly h: number;
  readonly css: string;
  readonly hex: string;
};

/** Always nine, in SWATCH_IDS order. Plain data: safe to serialise into a server component's props. */
export type Palette = readonly Swatch[];

/** The no-op every transform starts from, OKLCH. A neutral has no hue; 0 stands in. */
export const REFERENCE: Readonly<Record<SwatchId, { l: number; c: number; h: number }>> = {
  highlight: { l: 0.92, c: 0, h: 0 },
  mid: { l: 0.6, c: 0, h: 0 },
  shadow: { l: 0.3, c: 0, h: 0 },
  red: { l: 0.58, c: 0.19, h: 28 },
  skin: { l: 0.75, c: 0.09, h: 55 },
  yellow: { l: 0.86, c: 0.15, h: 100 },
  foliage: { l: 0.6, c: 0.13, h: 140 },
  sky: { l: 0.66, c: 0.11, h: 245 },
  blossom: { l: 0.68, c: 0.13, h: 340 },
};

type Gamma = PpSettings['gamma'];
type ColorMode = PpSettings['colorMode'];
type BlackGammaRange = PpSettings['blackGamma']['range'];

/** Tone a gamma or a Look lays down before any dial: ΔL at each end, a chroma factor. */
type Tone = { readonly shadow: number; readonly highlight: number; readonly chroma: number };
type LookBase = Tone & {
  readonly mid: number;
  /** Extra ΔL / chroma factor on named swatches. */
  readonly swatches?: Partial<Record<SwatchId, { readonly l?: number; readonly chroma?: number }>>;
  /** A cast the Look adds on every swatch, OKLab chroma at an OKLCH hue. */
  readonly cast?: { readonly c: number; readonly h: number };
};

const HLG: Tone = { shadow: 0.06, highlight: -0.1, chroma: 0.8 };
const SLOG: Tone = { shadow: 0.14, highlight: -0.14, chroma: 0.55 };
const FLAT: Tone = { shadow: 0, highlight: 0, chroma: 1 };

/**
 * Every magnitude the palette uses — neutral defaults, not measured.
 *
 * Signs follow Sony's documentation; sizes were set by eye so a full-range
 * dial reads clearly on a card without leaving the legibility band. The a7 IV
 * ColorChecker shoot refits this object and nothing else.
 */
export const PALETTE_WEIGHTS = {
  /** White Balance: mired vector → OKLab chroma, capped so a cast never shouts. */
  cast: { miredScale: 90, chroma: 0.06, maxChroma: 0.1 },

  /** Gamma family: shadow ΔL, highlight ΔL, chroma ×. The mid takes `midShare` of the mean of the two ends. */
  gamma: {
    Movie: FLAT,
    Still: FLAT,
    ITU709: FLAT,
    Cine1: { shadow: 0.05, highlight: -0.04, chroma: 0.97 },
    Cine2: { shadow: 0.05, highlight: -0.06, chroma: 0.97 },
    Cine3: { shadow: -0.02, highlight: -0.04, chroma: 1 },
    Cine4: { shadow: -0.05, highlight: -0.02, chroma: 1 },
    'S-Cinetone': { shadow: 0.03, highlight: -0.05, chroma: 0.9 },
    'ITU709(800%)': { shadow: 0.04, highlight: -0.08, chroma: 0.9 },
    'S-Log2': SLOG,
    'S-Log3': SLOG,
    HLG,
    HLG1: HLG,
    HLG2: HLG,
    HLG3: HLG,
  } satisfies Record<Gamma, Tone>,
  gammaMidShare: 0.5,

  /** Per unit of Black Level. Positive weakens black (TP0000909110). */
  blackLevel: { shadow: 0.008, mid: 0.003, darkHue: 0.004 },

  /** Per unit of Black Gamma level, scaled by how far the range reaches into grey. */
  blackGamma: {
    shadow: 0.006,
    reach: { Narrow: 0.6, Middle: 1, Wide: 1.3 } satisfies Record<BlackGammaRange, number>,
    mid: { Narrow: 0, Middle: 0.002, Wide: 0.004 } satisfies Record<BlackGammaRange, number>,
    /** Wide only: dark hues follow the shadow by this share. */
    wideDarkHueShare: 0.5,
  },

  /**
   * Knee Manual: compression = clamp((fullPoint − point) / pointSpan, 0, 1) ×
   * (slope max − slope) / (slope span), so slope +5 is off and a gentler slope
   * compresses more. Auto: a light roll-off on the gammas Sony lists.
   */
  knee: { fullPoint: 100, pointSpan: 25, highlight: -0.08, yellow: -0.04, auto: -0.02 },

  /** Saturation fraction f → chroma × (f < 0 ? 1 + down·f : 1 + up·f). PP and CL alike. */
  saturation: { down: 0.9, up: 0.6 },

  /** Degrees per unit of Color Phase. Negative: plus turns skin towards red. */
  colorPhase: -2.5,

  /**
   * Color Depth, per unit and channel, weighted by cos(hue gap) inside
   * `reachDeg` and by the swatch's chroma up to `fullChroma`. Plus lowers L
   * and raises C; an achromatic has weight 0 by construction.
   */
  colorDepth: { reachDeg: 60, fullChroma: 0.15, l: -0.01, c: 0.006 },

  /** Color Mode chroma ×. S-Gamut family is flat before grading. */
  colorMode: {
    Movie: 1,
    Still: 1,
    'S-Cinetone': 0.92,
    Cinema: 0.92,
    Pro: 1,
    '709tone': 1,
    'ITU709 Matrix': 1,
    'Black & White': 0,
    'S-Gamut': 0.7,
    'S-Gamut3': 0.7,
    'S-Gamut3.Cine': 0.7,
    'BT.2020': 1,
    '709': 1,
  } satisfies Record<ColorMode, number>,

  /** Creative Look base: shadow / mid / highlight ΔL and chroma ×, before the Look's own dials. */
  looks: {
    ST: { shadow: 0, mid: 0, highlight: 0, chroma: 1 },
    PT: { shadow: 0, mid: 0, highlight: 0, chroma: 0.95, swatches: { skin: { l: 0.02, chroma: 0.92 } } },
    NT: { shadow: 0.03, mid: 0, highlight: -0.03, chroma: 0.8 },
    VV: { shadow: -0.03, mid: 0, highlight: 0.02, chroma: 1.25 },
    VV2: { shadow: -0.02, mid: 0.02, highlight: 0.04, chroma: 1.35 },
    FL: {
      shadow: -0.03,
      mid: 0,
      highlight: -0.03,
      chroma: 0.85,
      swatches: { sky: { l: -0.03, chroma: 1.1 }, foliage: { l: -0.03, chroma: 1.1 } },
    },
    IN: { shadow: 0.06, mid: 0.02, highlight: -0.02, chroma: 0.9, cast: { c: 0.015, h: 70 } },
    SH: { shadow: 0.1, mid: 0.06, highlight: 0.03, chroma: 0.9 },
    BW: { shadow: 0, mid: 0, highlight: 0, chroma: 0 },
    SE: { shadow: 0, mid: 0, highlight: 0, chroma: 0 },
  } satisfies Record<CreativeLookCode, LookBase>,

  /** Sepia: no chroma, then this one warm cast on every swatch — the accent's sepia. */
  sepia: { c: 0.035, h: 70 },

  /** Creative Look dials, per unit. `*Share` is how far a hue follows the neutral it sits nearest. */
  clContrast: { shadow: -0.012, highlight: 0.008, darkHueShare: 0.5, lightHueShare: 0.5 },
  clHighlights: { highlight: 0.008, lightHue: 0.004 },
  clShadows: { shadow: 0.012, darkHue: 0.006 },
  /** Fade fraction f (0..1): lifts blacks, dims whites a little, lowers chroma. */
  clFade: { shadow: 0.2, mid: 0.04, highlight: -0.04, chroma: -0.27 },

  /** L floor keeps the shadow visible on the void ground. */
  bounds: { lMin: 0.14, lMax: 0.97 },
} as const;

/** Hues dark enough to follow the shadow under Black Level and Wide Black Gamma. */
const DARK_HUES: readonly SwatchId[] = ['red', 'foliage', 'sky'];
/** Hues that follow the shadow under CL Contrast and Shadows. */
const CL_DARK_HUES: readonly SwatchId[] = ['red', 'foliage'];
/** Hues that follow the highlight under CL Contrast. */
const CL_CONTRAST_LIGHT_HUES: readonly SwatchId[] = ['yellow', 'skin', 'sky'];
/** Hues that follow the highlight under CL Highlights. */
const CL_HIGHLIGHT_HUES: readonly SwatchId[] = ['skin', 'yellow'];

// ---------------------------------------------------------------------------

/** Working state: OKLab, so casts add and chroma factors scale on equal terms. */
type Lab = { L: number; a: number; b: number };
type State = Record<SwatchId, Lab>;

const RAD = Math.PI / 180;

const fromLch = (l: number, c: number, h: number): Lab => ({ L: l, a: c * Math.cos(h * RAD), b: c * Math.sin(h * RAD) });

function each(state: State, fn: (lab: Lab, id: SwatchId) => void) {
  for (const id of SWATCH_IDS) fn(state[id], id);
}

const lift = (state: State, ids: readonly SwatchId[], dl: number) => {
  for (const id of ids) state[id].L += dl;
};

const scaleChroma = (lab: Lab, k: number) => {
  lab.a *= k;
  lab.b *= k;
};

const addCast = (state: State, c: number, h: number) => {
  const [da, db] = [c * Math.cos(h * RAD), c * Math.sin(h * RAD)];
  each(state, (lab) => {
    lab.a += da;
    lab.b += db;
  });
};

const hueGap = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// --- 1. White balance ------------------------------------------------------

/**
 * The light the swatches are read under when the caller names none: the
 * neutral `wbBalance()` measures from, 5500K daylight.
 */
export const DAYLIGHT_K = 5500;

/**
 * A Kelvin setting's cast depends on the light it meets. `wbBalance()` measures
 * against 5500K daylight; a recipe built for tungsten or a night market is
 * read under the light it was built for, which moves only the Kelvin term:
 * 1e6/light − 1e6/setting in place of 1e6/5500 − 1e6/setting. AWB and the
 * presets publish no Kelvin (Rule 1), so their cast is the shift alone, under
 * any light.
 */
function whiteBalanceCast(state: State, recipe: AccentInput, light: number) {
  const w = PALETTE_WEIGHTS.cast;
  const balance = wbBalance(recipe.whiteBalance);
  const sceneOffset =
    recipe.whiteBalance.mode === 'kelvin' ? 1e6 / light - 1e6 / DAYLIGHT_K : 0;
  const warmth = balance.warmth + sceneOffset;
  const tint = balance.tint;
  const x =
    Math.abs(warmth) * Math.cos((warmth >= 0 ? WB_HUE.amber : WB_HUE.blue) * RAD) +
    Math.abs(tint) * Math.cos((tint >= 0 ? WB_HUE.magenta : WB_HUE.green) * RAD);
  const y =
    Math.abs(warmth) * Math.sin((warmth >= 0 ? WB_HUE.amber : WB_HUE.blue) * RAD) +
    Math.abs(tint) * Math.sin((tint >= 0 ? WB_HUE.magenta : WB_HUE.green) * RAD);
  const mired = Math.hypot(x, y);
  if (mired === 0) return;
  const c = clamp((mired / w.miredScale) * w.chroma, 0, w.maxChroma);
  addCast(state, c, Math.atan2(y, x) / RAD);
}

// --- 2. Tone ---------------------------------------------------------------

function applyTone(state: State, tone: Tone, mid: number) {
  state.shadow.L += tone.shadow;
  state.highlight.L += tone.highlight;
  state.mid.L += mid;
  each(state, (lab) => scaleChroma(lab, tone.chroma));
}

function ppTone(state: State, s: PpSettings) {
  const w = PALETTE_WEIGHTS;

  const gamma = w.gamma[s.gamma];
  applyTone(state, gamma, (w.gammaMidShare * (gamma.shadow + gamma.highlight)) / 2);

  state.shadow.L += w.blackLevel.shadow * s.blackLevel;
  state.mid.L += w.blackLevel.mid * s.blackLevel;
  lift(state, DARK_HUES, w.blackLevel.darkHue * s.blackLevel);

  const { range, level } = s.blackGamma;
  const shadowLift = w.blackGamma.shadow * level * w.blackGamma.reach[range];
  state.shadow.L += shadowLift;
  state.mid.L += w.blackGamma.mid[range] * level;
  if (range === 'Wide') lift(state, DARK_HUES, w.blackGamma.wideDarkHueShare * shadowLift);

  if (s.knee.mode === 'Manual') {
    const slope = PP_RANGES.kneeManualSlope;
    const compression =
      clamp((w.knee.fullPoint - s.knee.point) / w.knee.pointSpan, 0, 1) *
      ((slope.max - s.knee.slope) / (slope.max - slope.min));
    state.highlight.L += w.knee.highlight * compression;
    state.yellow.L += w.knee.yellow * compression;
  } else if ((PP_KNEE_AUTO_GAMMA as readonly string[]).includes(s.gamma)) {
    state.highlight.L += w.knee.auto;
  }
}

function clTone(state: State, s: ClSettings) {
  const w = PALETTE_WEIGHTS;

  const base: LookBase = w.looks[s.look];
  applyTone(state, base, base.mid);
  for (const [id, extra] of Object.entries(base.swatches ?? {}) as [SwatchId, { l?: number; chroma?: number }][]) {
    state[id].L += extra.l ?? 0;
    scaleChroma(state[id], extra.chroma ?? 1);
  }
  if (base.cast) addCast(state, base.cast.c, base.cast.h);

  const contrastShadow = w.clContrast.shadow * s.contrast;
  const contrastHighlight = w.clContrast.highlight * s.contrast;
  state.shadow.L += contrastShadow;
  state.highlight.L += contrastHighlight;
  lift(state, CL_DARK_HUES, w.clContrast.darkHueShare * contrastShadow);
  lift(state, CL_CONTRAST_LIGHT_HUES, w.clContrast.lightHueShare * contrastHighlight);

  state.highlight.L += w.clHighlights.highlight * s.highlights;
  lift(state, CL_HIGHLIGHT_HUES, w.clHighlights.lightHue * s.highlights);

  state.shadow.L += w.clShadows.shadow * s.shadows;
  lift(state, CL_DARK_HUES, w.clShadows.darkHue * s.shadows);

  const f = fraction(s.fade, CL_RANGES.fade);
  state.shadow.L += w.clFade.shadow * f;
  state.mid.L += w.clFade.mid * f;
  state.highlight.L += w.clFade.highlight * f;
  each(state, (lab) => scaleChroma(lab, 1 + w.clFade.chroma * f));
}

// --- 3. Colour -------------------------------------------------------------

function saturate(state: State, f: number) {
  const w = PALETTE_WEIGHTS.saturation;
  const k = f < 0 ? 1 + w.down * f : 1 + w.up * f;
  each(state, (lab) => scaleChroma(lab, k));
}

function ppColour(state: State, s: PpSettings) {
  const w = PALETTE_WEIGHTS;

  each(state, (lab) => scaleChroma(lab, w.colorMode[s.colorMode]));
  saturate(state, fraction(s.saturation, PP_RANGES.saturation));

  // Color Phase rotates every hue (TP0000909111), a cast on a neutral included.
  const turn = w.colorPhase * s.colorPhase * RAD;
  if (turn !== 0) {
    const [cos, sin] = [Math.cos(turn), Math.sin(turn)];
    each(state, (lab) => {
      const [a, b] = [lab.a, lab.b];
      lab.a = a * cos - b * sin;
      lab.b = a * sin + b * cos;
    });
  }

  // Color Depth, raw: each channel acts on the hues near its own, in
  // proportion to how saturated the swatch is. A neutral has no weight.
  const d = w.colorDepth;
  each(state, (lab, id) => {
    const ref = REFERENCE[id];
    if (ref.c === 0) return;
    let dl = 0;
    let dc = 0;
    for (const channel of PP_COLOR_DEPTH_CHANNELS) {
      const gap = hueGap(ref.h, CHANNEL_HUE[channel]);
      if (gap > d.reachDeg) continue;
      const weight = Math.cos(gap * RAD) * Math.min(1, ref.c / d.fullChroma);
      dl += d.l * s.colorDepth[channel] * weight;
      dc += d.c * s.colorDepth[channel] * weight;
    }
    lab.L += dl;
    const c = Math.hypot(lab.a, lab.b);
    const h = c === 0 ? ref.h : Math.atan2(lab.b, lab.a) / RAD;
    const next = Math.max(0, c + dc);
    lab.a = next * Math.cos(h * RAD);
    lab.b = next * Math.sin(h * RAD);
  });
}

function clColour(state: State, s: ClSettings) {
  if (s.saturation !== undefined) saturate(state, fraction(s.saturation, CL_RANGES.saturation));
}

/** Black & White: no chroma anywhere, cast included. Sepia: none, then one warm cast. */
function monochrome(state: State, recipe: AccentInput) {
  const mono = monochromeOf(recipe);
  if (!mono) return;
  each(state, (lab) => {
    lab.a = 0;
    lab.b = 0;
  });
  if (mono === 'sepia') addCast(state, PALETTE_WEIGHTS.sepia.c, PALETTE_WEIGHTS.sepia.h);
}

// --- 4. Bounds -------------------------------------------------------------

/** `oklch(78.0% 0.09 65)` — the `accentCss` shape. */
const css = (l: number, c: number, h: number) => `oklch(${(l * 100).toFixed(1)}% ${c} ${h})`;

function finish(id: SwatchId, lab: Lab): Swatch {
  const { lMin, lMax } = PALETTE_WEIGHTS.bounds;
  // Rounded before the gamut map, so the emitted value is the mapped one.
  const l = Number(clamp(lab.L, lMin, lMax).toFixed(3));
  const chroma = Math.hypot(lab.a, lab.b);
  const rawHue = chroma < 1e-12 ? REFERENCE[id].h : Math.atan2(lab.b, lab.a) / RAD;
  const h = Number((((rawHue % 360) + 360) % 360).toFixed(1)) % 360;
  const mapped = gamutMap({ l, c: chroma, h });
  // Floored, not rounded: a smaller chroma at the same L and h stays in gamut.
  // The 1e-6 keeps float noise (0.18999999…) from costing a whole step.
  const c = Math.floor(mapped.c * 1e4 + 1e-6) / 1e4;
  return { id, l, c, h, css: css(l, c, h), hex: oklchToHex({ l, c, h }) };
}

/**
 * The nine swatches for a recipe, in camera order: White Balance cast, then
 * tone (gamma or Look, and their dials), then colour (Color Mode, Saturation,
 * Color Phase, Color Depth), then bounds.
 *
 * `light` is the Kelvin of the light the recipe is built for — daylight unless
 * the editor's manifest says otherwise (Sài Gòn Café's bulbs, a night market).
 */
export function paletteFor(recipe: AccentInput, { light = DAYLIGHT_K }: { light?: number } = {}): Palette {
  const state = Object.fromEntries(
    SWATCH_IDS.map((id) => [id, fromLch(REFERENCE[id].l, REFERENCE[id].c, REFERENCE[id].h)]),
  ) as State;

  whiteBalanceCast(state, recipe, light);

  if (recipe.format === 'pp') {
    ppTone(state, recipe.settings);
    ppColour(state, recipe.settings);
  } else {
    clTone(state, recipe.settings);
    clColour(state, recipe.settings);
  }

  monochrome(state, recipe);

  return SWATCH_IDS.map((id) => finish(id, state[id]));
}

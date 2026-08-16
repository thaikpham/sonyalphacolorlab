/**
 * Derives a display accent colour from a recipe's colour science.
 *
 * The interface takes its colour from the recipe itself rather than from an
 * arbitrary brand palette. Two things drive it, summed as vectors in OKLCH hue
 * space so they combine on equal terms:
 *
 *   1. White Balance — the overall cast (a warm 8000K glows amber, an A7 shift
 *      pushes further amber, an M shift pulls magenta).
 *   2. Picture Profile Color Depth — which hues the recipe deepens. This is
 *      where most recipes get their character: "Kyoto Jade" is not jade because
 *      of its white balance, it is jade because G is pushed to +7.
 *
 * Using White Balance alone was measurably wrong — "Phoenix Fire" came out
 * green and "Arctic Negative" orange, because nearly every recipe warms the
 * scene with an amber shift and then sculpts colour through Color Depth.
 *
 * IMPORTANT: this is a perceptual approximation for UI accents, not colorimetry.
 * It does not predict what the camera will render, and nothing about a recipe's
 * correctness depends on it. Never use it to compute camera values.
 */

import type { Recipe, WhiteBalance } from './schema';

/** OKLCH hue of each colour phase, from the saturated sRGB primaries. */
const CHANNEL_HUE = { R: 29, Y: 110, G: 142, C: 195, B: 264, M: 328 } as const;

/** OKLCH hue of each White Balance direction. */
const WB_HUE = { amber: 65, blue: 264, green: 142, magenta: 328 } as const;

/** Kelvin treated as neutral. */
const NEUTRAL_K = 5500;

/**
 * Colour temperature is combined in **mireds** (10^6 / K), not Kelvin.
 *
 * Mireds are perceptually near-linear and additive, which Kelvin is not: the
 * step from 2500K to 3000K is a far larger visual change than 9000K to 9500K.
 * Working in Kelvin also made the scale symmetric, which it is not — from
 * 5500K neutral the warm side only reaches +81 mired while the cool side runs
 * to -218. Working in mireds puts Kelvin and the A/B shift on the same physical
 * footing instead of an invented ratio.
 */
const NEUTRAL_MIRED = 1e6 / NEUTRAL_K;

/**
 * ⚠ FITTED, NOT SOURCED — needs confirmation against a real body.
 *
 * Sony does not publish the mired value of one A/B shift step. 5 mired (the
 * usual Canon figure) reproduced only 3 of the 8 recipes whose own description
 * states an explicit warm or cool cast; 17 reproduces 7. The single miss,
 * "Mojave Sun", describes both "warm glow" and "deep blues", so it is not a
 * clean label.
 *
 * The alternative hypothesis — that higher Kelvin renders *cooler* — was tested
 * and scored worse (5/8), so the standard convention holds and only the step
 * size was wrong.
 *
 * This is one parameter fitted to eight hand-read labels, so treat it as a
 * working estimate. `accent-fidelity.test.ts` pins the resulting classification:
 * if this number changes, that test names exactly which recipes disagree.
 */
export const MIRED_PER_SHIFT_STEP = 17;

/** Divisor bringing mired offsets into roughly -1..1 for the vector sum. */
const MIRED_SCALE = 90;

/**
 * Scales the Color Depth vector so its median magnitude across the catalogue
 * matches White Balance's, giving the two signals equal say (measured: WB
 * median 0.496, Color Depth median 8.988).
 *
 * Deliberately not normalised per recipe: a recipe with flat Color Depth
 * ("Amber Glow") produces a short vector and lets White Balance decide, while
 * one with strong character ("Kyoto Jade") produces a long vector and
 * overrides it. That behaviour falls out of the magnitudes for free.
 *
 * ⚠ Equal weighting is a neutral default, not a validated one. See
 * `accent-fidelity.test.ts` for why this model is not tuned further.
 */
const DEPTH_SCALE = 0.0551;

export type Range = { readonly min: number; readonly max: number; readonly step: number };
export type Accent = { l: number; c: number; h: number };

type Vec = readonly [number, number];

const polar = (hueDeg: number, magnitude: number): Vec => {
  const r = (hueDeg * Math.PI) / 180;
  return [magnitude * Math.cos(r), magnitude * Math.sin(r)];
};

const add = (a: Vec, b: Vec): Vec => [a[0] + b[0], a[1] + b[1]];

/** Recipes shot in monochrome, where any hue would be a lie. */
function monochromeOf(recipe: AccentInput): 'bw' | 'sepia' | null {
  if (recipe.format === 'cl') {
    if (recipe.settings.look === 'BW') return 'bw';
    if (recipe.settings.look === 'SE') return 'sepia';
    return null;
  }
  return recipe.settings.colorMode === 'Black & White' ? 'bw' : null;
}

/**
 * A White Balance resolved onto its two axes, in mireds.
 *
 * The point of splitting `kelvin` from `shift` rather than returning only the
 * total: Temperature and Shift A/B are the *same* amber–blue axis in different
 * units, so a recipe can set them against each other. Keeping both terms is
 * what lets a caller say "the Kelvin warms, the shift pulls back" instead of
 * only reporting where the two landed.
 */
export type WbBalance = {
  /** Amber–blue contribution of the Kelvin dial. Positive is warmer. */
  kelvin: number;
  /** Amber–blue contribution of the A/B shift. Positive (A) is warmer. */
  shift: number;
  /** `kelvin + shift` — what the amber–blue axis actually reads as. */
  warmth: number;
  /** Green–magenta offset. Positive is magenta. Kelvin never reaches this axis. */
  tint: number;
};

/**
 * ⚠ The magnitudes here inherit `MIRED_PER_SHIFT_STEP`, which is fitted rather
 * than sourced. Signs and ordering are sound; treat the numbers as an estimate.
 */
export function wbBalance(wb: WhiteBalance): WbBalance {
  // Setting a higher Kelvin tells the camera the light is bluer, so it warms
  // the image to compensate. Higher K therefore renders warmer, not cooler.
  const kelvin = wb.mode === 'kelvin' ? NEUTRAL_MIRED - 1e6 / wb.kelvin : 0;

  const ab = wb.shift?.ab;
  const gm = wb.shift?.gm;

  // A = amber = warm. B = blue = cool.
  const shift = ab ? (ab.axis === 'A' ? ab.amount : -ab.amount) * MIRED_PER_SHIFT_STEP : 0;

  // M = magenta. G = green.
  const tint = gm ? (gm.axis === 'M' ? gm.amount : -gm.amount) * MIRED_PER_SHIFT_STEP : 0;

  return { kelvin, shift, warmth: kelvin + shift, tint };
}

function whiteBalanceVector(wb: WhiteBalance): Vec {
  const balance = wbBalance(wb);
  const warmth = balance.warmth / MIRED_SCALE;
  const tint = balance.tint / MIRED_SCALE;

  return add(
    polar(warmth >= 0 ? WB_HUE.amber : WB_HUE.blue, Math.abs(warmth)),
    polar(tint >= 0 ? WB_HUE.magenta : WB_HUE.green, Math.abs(tint)),
  );
}

/**
 * Color Depth as a hue vector.
 *
 * Each channel is centred on the recipe's own six-channel mean, so what counts
 * is which hues this recipe emphasises *relative to itself*. Centring matters:
 * G averages +3.1 across the catalogue because deepening green flatters
 * foliage and skin, so raw values would tint almost everything green.
 *
 * Centring on the recipe's own mean rather than the catalogue's also keeps a
 * recipe's colour stable — adding new recipes never restyles existing ones.
 */
function colorDepthVector(depth: Record<keyof typeof CHANNEL_HUE, number>): Vec {
  const channels = Object.keys(CHANNEL_HUE) as (keyof typeof CHANNEL_HUE)[];
  const mean = channels.reduce((sum, c) => sum + depth[c], 0) / channels.length;

  return channels.reduce<Vec>(
    (acc, c) => add(acc, polar(CHANNEL_HUE[c], (depth[c] - mean) * DEPTH_SCALE)),
    [0, 0],
  );
}

/**
 * A plain `Pick<Recipe, …>` would collapse the discriminated union and lose the
 * correlation between `format` and `settings`, so the pick is distributed over
 * each member instead.
 */
type DistributivePick<T, K extends keyof T> = T extends unknown ? Pick<T, K> : never;

export type AccentInput = DistributivePick<Recipe, 'format' | 'whiteBalance' | 'settings'>;

/**
 * OKLCH accent for a recipe. Lightness is held high and chroma capped so every
 * accent stays legible on the dark background — no recipe can produce a colour
 * that vibrates or disappears.
 */
export function accentFor(recipe: AccentInput): Accent {
  const mono = monochromeOf(recipe);

  // A monochrome recipe gets no hue. Sepia keeps a trace of warmth, because
  // that is what sepia is; black and white gets none at all.
  if (mono === 'bw') return { l: 0.78, c: 0, h: 0 };
  if (mono === 'sepia') return { l: 0.775, c: 0.035, h: 70 };

  const wb = whiteBalanceVector(recipe.whiteBalance);
  const depth =
    recipe.format === 'pp' ? colorDepthVector(recipe.settings.colorDepth) : ([0, 0] as Vec);

  const [x, y] = add(wb, depth);
  const distance = Math.hypot(x, y);

  // Chroma rises with distance from neutral but saturates, so an extreme recipe
  // is vivid without being neon.
  const c = Math.min(0.15, distance * 0.13);
  const h = distance === 0 ? 0 : (((Math.atan2(y, x) * 180) / Math.PI) % 360 + 360) % 360;

  // Lift lightness slightly as chroma falls so neutral recipes read as light
  // grey rather than muddy.
  const l = 0.78 - c * 0.35;

  return { l: round(l, 3), c: round(c, 4), h: round(h, 1) };
}

const round = (n: number, p: number) => Number(n.toFixed(p));

/** `oklch(78% 0.09 65)` — ready for a CSS custom property. */
export function accentCss(a: Accent): string {
  return `oklch(${(a.l * 100).toFixed(1)}% ${a.c} ${a.h})`;
}

/**
 * OKLCH -> sRGB hex.
 *
 * Needed because not every renderer speaks `oklch()`. Satori — the engine
 * behind `next/og` ImageResponse — silently ignores it, which produces a share
 * card with no colour at all rather than an error. Anything generating an image
 * rather than a stylesheet must use this.
 *
 * Standard OKLab matrices (Björn Ottosson), then the sRGB transfer function.
 * Out-of-gamut values are clamped per channel.
 */
export function accentHex(a: Accent): string {
  const hRad = (a.h * Math.PI) / 180;
  const oa = a.c * Math.cos(hRad);
  const ob = a.c * Math.sin(hRad);

  const l_ = a.l + 0.3963377774 * oa + 0.2158037573 * ob;
  const m_ = a.l - 0.1055613458 * oa - 0.0638541728 * ob;
  const s_ = a.l - 0.0894841775 * oa - 1.291485548 * ob;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];

  const channel = (v: number) => {
    const encoded = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
    return Math.round(Math.min(1, Math.max(0, encoded)) * 255)
      .toString(16)
      .padStart(2, '0');
  };

  return `#${linear.map(channel).join('')}`;
}

/**
 * Position on the camera's WB Shift grid, normalised to -1..1 on each axis,
 * for plotting a recipe on the shift plane. Kelvin and Color Depth are
 * deliberately excluded — this is the shift grid the camera shows, nothing else.
 */
export function shiftPosition(wb: WhiteBalance): { x: number; y: number } {
  const ab = wb.shift?.ab;
  const gm = wb.shift?.gm;
  return {
    x: ab ? (ab.axis === 'A' ? ab.amount : -ab.amount) / 7 : 0,
    y: gm ? (gm.axis === 'M' ? gm.amount : -gm.amount) / 7 : 0,
  };
}

/**
 * What the dials actually look like, as colour.
 *
 * - White Balance Kelvin: < 4000K (blue), 4100K-5900K (neutral), >= 6000K (orange)
 * - WB Shift: B (blue), G (green), M (magenta), A (amber)
 * - Color Depth: R, G, B, C, M, Y
 *
 * These are the one place amber and green survive the no-competitor-hue rule,
 * and they are not an exception to it. That rule governs colours the
 * *interface* chooses; these are the recipe's own measured cast rendered as
 * itself. An A-shift is amber — drawing it in the accent would be drawing the
 * wrong number. Same category as `--accent`, which is also recomputed per
 * recipe rather than picked from the ramp.
 *
 * ONE FORMAT ONLY. There used to be a second set of these returning Tailwind
 * classes (`text-amber-400`, `text-emerald-400`, …), which put sRGB palette
 * colours in an OKLCH interface — the exact drift the token package exists to
 * stop — and gave the same cast two definitions that could disagree. Call
 * sites apply the value through `style={{ color }}`, which is also the only
 * form that works for the plotted points in `wb-shift-plane.tsx`.
 */

export function getKelvinHexColor(kelvin: number): string {
  if (kelvin < 4000) return '#60a5fa'; // Blue
  if (kelvin >= 6000) return '#fb923c'; // Orange
  return 'var(--color-ink)'; // Neutral — the interface's own ink, not a literal
}

export function getWbShiftAxisHexColor(axis: 'A' | 'B' | 'G' | 'M' | string): string {
  switch (axis) {
    case 'B': return '#60a5fa'; // Blue
    case 'G': return '#34d399'; // Green
    case 'M': return '#f472b6'; // Magenta/Pink
    case 'A': return '#fbbf24'; // Amber/Orange
    default: return 'var(--color-ink)';
  }
}

export function getColorDepthChannelHexColor(channel: 'R' | 'G' | 'B' | 'C' | 'M' | 'Y' | string): string {
  switch (channel) {
    case 'R': return '#f87171'; // Red
    case 'G': return '#34d399'; // Green
    case 'B': return '#60a5fa'; // Blue
    case 'C': return '#22d3ee'; // Cyan
    case 'M': return '#f472b6'; // Magenta
    case 'Y': return '#facc15'; // Yellow
    default: return '#ffffff';
  }
}


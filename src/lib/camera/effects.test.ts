import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AXIS_LABELS, clEffects, ppEffects, wbEffects, wbSummary, type Effect } from './effects';
import {
  CL_PARAM_ORDER,
  PP_COLOR_DEPTH_CHANNELS,
  PP_RANGES,
  WB_PRESETS,
  WB_PRESETS_STILL_ONLY,
} from './constants';
import type { Recipe } from './schema';

/**
 * Effects are value-aware, which is the whole point — the same parameter must
 * read differently at opposite ends of its range. These tests pin that, and
 * guarantee no parameter in a real recipe renders an empty cell.
 */

const recipes = JSON.parse(readFileSync('data/recipes.seed.json', 'utf8')) as Recipe[];
const pp = recipes.filter((r): r is Extract<Recipe, { format: 'pp' }> => r.format === 'pp');

const basePp = pp[0].settings;
const withPp = (patch: Partial<typeof basePp>) => ppEffects({ ...basePp, ...patch });

const baseCl = {
  look: 'ST' as const,
  contrast: 0, highlights: 0, shadows: 0, fade: 0,
  saturation: 0, sharpness: 0, sharpnessRange: 3, clarity: 0,
};

const bothLocalesFilled = (e: Effect) => e.en.length > 5 && e.vi.length > 5;

describe('value-aware effects', () => {
  it('describes opposite ends of a range differently', () => {
    const low = withPp({ blackLevel: PP_RANGES.blackLevel.min }).blackLevel;
    const high = withPp({ blackLevel: PP_RANGES.blackLevel.max }).blackLevel;
    expect(low.en).not.toBe(high.en);
    expect(low.vi).not.toBe(high.vi);
    // The direction has to be right, not merely different.
    expect(low.en.toLowerCase()).toContain('crushed');
    expect(high.en.toLowerCase()).toContain('lifted');
  });

  it('grades intensity rather than flipping at zero', () => {
    const mild = withPp({ saturation: 8 }).saturation;
    const strong = withPp({ saturation: PP_RANGES.saturation.max }).saturation;
    expect(mild.en).not.toBe(strong.en);
  });

  it('reads a neutral value as neutral', () => {
    expect(withPp({ colorPhase: 0 }).colorPhase.en.toLowerCase()).toContain('left');
  });

  it('tags each effect with the axis it acts on', () => {
    const e = withPp({});
    expect(e.blackLevel.axis).toBe('contrast');
    expect(e.saturation.axis).toBe('color');
    expect(e.detailLevel.axis).toBe('detail');
    expect(Object.keys(AXIS_LABELS).sort()).toEqual(['color', 'contrast', 'detail']);
  });

  it('names the actual colour channel in Color Depth effects', () => {
    const e = withPp({ colorDepth: { R: 7, G: -7, B: 0, C: 0, M: 0, Y: 0 } });
    expect(e['colorDepth.R'].en).toContain('Reds');
    expect(e['colorDepth.G'].en).toContain('Greens');
    expect(e['colorDepth.R'].en).not.toBe(e['colorDepth.G'].en);
    expect(e['colorDepth.R'].vi).toContain('đỏ');
  });

  it('distinguishes the gamma families', () => {
    const slog = withPp({ gamma: 'S-Log3' }).gamma.en;
    const hlg = withPp({ gamma: 'HLG3' }).gamma.en;
    const cine = withPp({ gamma: 'Cine1' }).gamma.en;
    expect(new Set([slog, hlg, cine]).size).toBe(3);
    expect(slog).toContain('log');
    expect(hlg).toContain('HDR');
  });

  it('calls out a disabled knee', () => {
    const off = withPp({ knee: { mode: 'Manual', point: 90, slope: 5 } }).knee.en;
    expect(off.toLowerCase()).toContain('off');
  });

  it('says Black & White has no colour', () => {
    expect(withPp({ colorMode: 'Black & White' }).colorMode.en.toLowerCase()).toContain('monochrome');
  });
});

describe('coverage', () => {
  it('produces an effect for every Picture Profile row in every real recipe', () => {
    // Every row the table renders, including the Detail sub-settings — those
    // shipped with an empty third column until this list caught it.
    const expected = [
      'blackLevel', 'gamma', 'blackGamma', 'knee', 'colorMode', 'saturation',
      'colorPhase', 'detailLevel', 'detailMode', 'vhBalance', 'bwBalance',
      'detailLimit', 'crispening', 'hiLightDetail',
      ...PP_COLOR_DEPTH_CHANNELS.map((c) => `colorDepth.${c}`),
    ];
    for (const r of pp) {
      const e = ppEffects(r.settings);
      for (const key of expected) {
        expect(e[key], `${r.id} missing effect for ${key}`).toBeDefined();
        expect(bothLocalesFilled(e[key]), `${r.id}.${key} has an empty locale`).toBe(true);
      }
    }
  });

  it('produces an effect for every Creative Look parameter', () => {
    const e = clEffects(baseCl);
    for (const p of CL_PARAM_ORDER) {
      expect(e[p], `missing effect for ${p}`).toBeDefined();
      expect(bothLocalesFilled(e[p])).toBe(true);
    }
    expect(e.look).toBeDefined();
  });

  it('omits Saturation for monochrome Looks instead of inventing one', () => {
    const { saturation: _drop, ...noSat } = baseCl;
    const e = clEffects({ ...noSat, look: 'BW' });
    expect(e.saturation).toBeUndefined();
    expect(e.look.en.toLowerCase()).toContain('monochrome');
  });

  it('never returns an empty string for any legal value in a range', () => {
    for (let v = PP_RANGES.blackLevel.min; v <= PP_RANGES.blackLevel.max; v++) {
      expect(bothLocalesFilled(withPp({ blackLevel: v }).blackLevel), `blackLevel=${v}`).toBe(true);
    }
    for (let v = PP_RANGES.saturation.min; v <= PP_RANGES.saturation.max; v++) {
      expect(bothLocalesFilled(withPp({ saturation: v }).saturation), `saturation=${v}`).toBe(true);
    }
  });
});


describe('white balance effects', () => {
  const wb = (kelvin: number, shift?: Record<string, unknown>) =>
    wbEffects({ mode: 'kelvin', kelvin, ...(shift ? { shift } : {}) } as never);

  it('describes each control on its own, not the combined cast', () => {
    // A7 warms while 3700K is set below neutral — the rows must not agree.
    const e = wb(3700, { ab: { axis: 'A', amount: 7 } });
    expect(e.temperature.en.toLowerCase()).toContain('cool');
    expect(e.shiftAb.en.toLowerCase()).toContain('warm');
  });

  it('grades shift strength', () => {
    expect(wb(5500, { ab: { axis: 'A', amount: 7 } }).shiftAb.en).not.toBe(
      wb(5500, { ab: { axis: 'A', amount: 0.5 } }).shiftAb.en,
    );
  });

  it('reads Kelvin in mireds, not linearly', () => {
    // The same 500K step is a far bigger visual move at the bottom of the range
    // than the top: 3500->4000 spans 36 mired and changes the description,
    // 9000->9500 spans 6 mired and does not. A linear reading would treat the
    // two steps as identical.
    expect(wb(3500).temperature.en).not.toBe(wb(4000).temperature.en);
    expect(wb(9000).temperature.en).toBe(wb(9500).temperature.en);
  });

  it('omits a shift row the recipe never set', () => {
    const e = wb(5600);
    expect(e.shiftAb).toBeUndefined();
    expect(e.shiftGm).toBeUndefined();
    expect(e.temperature).toBeDefined();
  });

  it('says AWB hands the decision to the camera', () => {
    const e = wbEffects({ mode: 'auto', auto: 'AWB' } as never);
    expect(e.temperature.en.toLowerCase()).toContain('camera decides');
  });

  it('reads a zero shift as no shift', () => {
    // The admin form starts a shift at WB_SHIFT_AXIS.min, which is 0.
    const e = wb(5500, { ab: { axis: 'B', amount: 0 }, gm: { axis: 'G', amount: 0 } });
    expect(e.shiftAb.en).not.toContain('Slight');
    expect(e.shiftGm.en).not.toContain('Slight');
    expect(e.shiftAb.en).toContain('No');
    const preset = wbSummary({ mode: 'preset', preset: 'Cloudy', shift: { ab: { axis: 'B', amount: 0 } } });
    expect(preset.net.en).toContain('balances for Cloudy');
  });

  it('describes every light-source preset by name, in both places', () => {
    for (const preset of WB_PRESETS) {
      const e = wbEffects({ mode: 'preset', preset });
      expect(e.temperature.en, preset).not.toBe('Balanced for the selected light source');
      expect(bothLocalesFilled(e.temperature), preset).toBe(true);
      // Still-only is a sourced fact in constants.ts, not retyped per phrase.
      const stillOnly = (WB_PRESETS_STILL_ONLY as readonly string[]).includes(preset);
      expect(e.temperature.en.includes('still images only'), preset).toBe(stillOnly);
      expect(wbSummary({ mode: 'preset', preset }).net.en, preset).toContain(preset);
    }
  });

  it('fills both locales', () => {
    const e = wb(3700, { ab: { axis: 'A', amount: 7 }, gm: { axis: 'M', amount: 0.5 } });
    for (const key of ['temperature', 'shiftAb', 'shiftGm']) {
      expect(e[key].en.length).toBeGreaterThan(10);
      expect(e[key].vi.length).toBeGreaterThan(10);
    }
  });
});

/**
 * The summary exists because the per-row text structurally cannot answer "so
 * what does the picture look like". These pin the two things it adds: a net
 * reading that follows the sum rather than either dial, and an explanation that
 * only appears when there is an apparent contradiction to explain.
 */
describe('white balance summary', () => {
  const sum = (kelvin: number, shift?: Record<string, unknown>) =>
    wbSummary({ mode: 'kelvin', kelvin, ...(shift ? { shift } : {}) } as never);

  it('reports the sum, not the Kelvin row', () => {
    // 8000K alone renders warm. Adding a full blue shift must not still read warm.
    expect(sum(8000).net.en.toLowerCase()).toContain('warm');
    expect(sum(8000, { ab: { axis: 'B', amount: 7 } }).net.en.toLowerCase()).not.toContain('warm');
  });

  it('will not name a direction the fitted shift step cannot support', () => {
    // Mojave Sun. The two terms land 0.1 mired apart, which is far inside the
    // uncertainty of MIRED_PER_SHIFT_STEP — calling that "cool" would be
    // inventing precision. Well outside the band it must still commit.
    expect(sum(7000, { ab: { axis: 'B', amount: 3 } }).net.en).toContain('cancel');
    expect(sum(7000, { ab: { axis: 'B', amount: 6 } }).net.en.toLowerCase()).toContain('cool');
  });

  it('keeps the wide band for shifts only — an unshifted Kelvin still commits', () => {
    // 6000K is +15 mired: inside one shift step, but there is no shift here and
    // Kelvin converts to mireds exactly, so there is nothing to be unsure about.
    expect(sum(6000).net.en.toLowerCase()).toContain('warm');
  });

  it('explains the pairing that looks like a mistake', () => {
    const { interplay } = sum(8000, { ab: { axis: 'B', amount: 3 } });
    expect(interplay?.en).toContain('8000K');
    expect(interplay?.en).toContain('B3');
    expect(interplay?.en.toLowerCase()).toContain('same amber–blue axis');
    expect(interplay?.vi).toContain('8000K');
    expect(interplay?.vi.toLowerCase()).toContain('cùng một trục');
  });

  it('says "stack" when both controls push the same way', () => {
    const { interplay } = sum(8000, { ab: { axis: 'A', amount: 3 } });
    expect(interplay?.en.toLowerCase()).toContain('stack');
    expect(interplay?.en.toLowerCase()).not.toContain('contradiction');
  });

  it('offers no interplay when there is no tension to explain', () => {
    expect(sum(8000).interplay).toBeUndefined();
    expect(sum(5500, { ab: { axis: 'B', amount: 3 } }).interplay).toBeUndefined();
    expect(wbSummary({ mode: 'auto', auto: 'AWB' } as never).interplay).toBeUndefined();
  });

  it('carries the G/M tint into the conclusion, in both locales', () => {
    const plain = sum(5500);
    const tinted = sum(5500, { gm: { axis: 'G', amount: 5 } });
    expect(tinted.net.en).not.toBe(plain.net.en);
    expect(tinted.net.en.toLowerCase()).toContain('green');
    expect(tinted.net.vi.toLowerCase()).toContain('xanh lá');
  });

  it('says the shift pulls past a base it outweighs, and only part of one it does not', () => {
    // Kyoto Jade. 3700K is -88.5 mired and A7 is +119: the net lands warm, so
    // "pulls part of it back" contradicted the net sentence right above it.
    const past = sum(3700, { ab: { axis: 'A', amount: 7 } });
    expect(past.net.en.toLowerCase()).toContain('warm');
    expect(past.interplay?.en).not.toContain('part of it back');
    expect(past.interplay?.en).toContain('past it');
    expect(past.interplay?.vi).toContain('vượt qua');

    const partial = sum(8000, { ab: { axis: 'B', amount: 2 } });
    expect(partial.net.en.toLowerCase()).toContain('warm');
    expect(partial.interplay?.en).toContain('part of it back');
  });

  it('names no side in the interplay when the net is inside one shift step', () => {
    // Mojave Sun again: the net says "cancel", so the interplay may not say
    // which side of neutral the pair lands on either.
    const { net, interplay } = sum(7000, { ab: { axis: 'B', amount: 3 } });
    expect(net.en).toContain('cancel');
    expect(interplay?.en).not.toContain('past it');
    expect(interplay?.en).not.toContain('part of it back');
    expect(interplay?.en).toContain('about neutral');
  });

  it('does not claim the pair reaches what the Kelvin dial cannot', () => {
    // A net of +30.5 mired is a Kelvin value the dial sets directly.
    for (const recipe of recipes) {
      const { interplay } = wbSummary(recipe.whiteBalance);
      expect(interplay?.en ?? '', recipe.slug).not.toContain('cannot reach');
    }
  });

  it('offers no interplay for a Kelvin the Temperature row calls neutral', () => {
    // 5600K is 3.2 mired and 5200K -10.5: the row reads "Close to neutral
    // daylight", so the summary may not call either a warm or cool base.
    expect(sum(5600, { ab: { axis: 'B', amount: 4 } }).interplay).toBeUndefined();
    expect(sum(5200, { ab: { axis: 'A', amount: 4 } }).interplay).toBeUndefined();
    for (const recipe of recipes) {
      const neutralRow = wbEffects(recipe.whiteBalance).temperature.en.startsWith('Close to neutral');
      if (neutralRow) expect(wbSummary(recipe.whiteBalance).interplay, recipe.slug).toBeUndefined();
    }
  });

  it('keeps a neutral amber–blue reading from denying the tint it then adds', () => {
    // SCL-CL-021 and Mojave Sun: "not from the white balance", then a magenta
    // tint that IS the white balance.
    for (const shift of [
      { ab: { axis: 'B', amount: 2.5 }, gm: { axis: 'M', amount: 5 } },
      { ab: { axis: 'B', amount: 3 }, gm: { axis: 'M', amount: 1.5 } },
    ]) {
      const { net } = sum(shift.ab.amount === 3 ? 7000 : 6500, shift);
      expect(net.en).not.toContain('not from the white balance');
      expect(net.en).toContain('magenta');
      expect(net.vi).not.toContain('không phải từ cân bằng trắng');
    }
    expect(sum(5500, { gm: { axis: 'G', amount: 5 } }).net.en).not.toContain('whites stay white');
    // Untinted, the strong claim still holds.
    expect(sum(5500).net.en).toContain('whites stay white');
  });

  it('only says the two controls cancel when they pull against each other', () => {
    // 5900K (+12.3) and A0.25 (+4.25) both warm; they stack, never cancel.
    expect(sum(5900, { ab: { axis: 'A', amount: 0.25 } }).net.en).not.toContain('cancel');
  });

  it('produces a net reading for every recipe in the catalogue, in both locales', () => {
    for (const recipe of recipes) {
      const { net } = wbSummary(recipe.whiteBalance);
      expect(net.en.length, recipe.slug).toBeGreaterThan(20);
      expect(net.vi.length, recipe.slug).toBeGreaterThan(20);
    }
  });
});

describe('unsigned intensity params grade up from their minimum', () => {
  /* Fade, Sharpness and Clarity (0–9) and the PP Detail Limit, Crispening and
     Hi-Light Detail were graded around their midpoint, so the whole low half
     of each range fell back to the wording for the minimum: Fade 3 read
     "No fade", Sharpness 4 "No sharpening", and every PP recipe at Limit 3
     read "capped hard". Only the minimum itself may say "none". */
  it('keeps the "none" wording for the minimum only', () => {
    expect(clEffects({ ...baseCl, fade: 0 }).fade.en).toMatch(/^No fade/);
    expect(clEffects({ ...baseCl, fade: 3 }).fade.en).not.toMatch(/^No fade/);
    expect(clEffects({ ...baseCl, sharpness: 4 }).sharpness.en).not.toMatch(/^No sharpening/);
    expect(clEffects({ ...baseCl, clarity: 1 }).clarity.en).not.toMatch(/^No clarity/);
    expect(withPp({ detail: { ...basePp.detail, hiLightDetail: 2 } }).hiLightDetail.en).not.toMatch(/^No extra/);
    expect(withPp({ detail: { ...basePp.detail, limit: 3 } }).detailLimit.en).not.toMatch(/capped hard/);
  });

  it('describes every value above the minimum with a non-minimum phrase', () => {
    for (const param of ['fade', 'sharpness', 'clarity'] as const) {
      const none = clEffects({ ...baseCl, [param]: 0 })[param].en;
      for (let v = 1; v <= 9; v++) {
        expect(clEffects({ ...baseCl, [param]: v })[param].en, `${param} ${v}`).not.toBe(none);
      }
    }
  });
});

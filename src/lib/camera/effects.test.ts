import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AXIS_LABELS, clEffects, ppEffects, wbEffects, type Effect } from './effects';
import { CL_PARAM_ORDER, PP_COLOR_DEPTH_CHANNELS, PP_RANGES } from './constants';
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

  it('fills both locales', () => {
    const e = wb(3700, { ab: { axis: 'A', amount: 7 }, gm: { axis: 'M', amount: 0.5 } });
    for (const key of ['temperature', 'shiftAb', 'shiftGm']) {
      expect(e[key].en.length).toBeGreaterThan(10);
      expect(e[key].vi.length).toBeGreaterThan(10);
    }
  });
});

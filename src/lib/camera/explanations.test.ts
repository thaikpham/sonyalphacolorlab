import { describe, expect, it } from 'vitest';
import {
  CL_EXPLANATIONS,
  COLOR_DEPTH_EXPLANATIONS,
  PP_DETAIL_EXPLANATIONS,
  PP_EXPLANATIONS,
  WB_OVERVIEW,
} from './explanations';
import {
  CL_PARAM_ORDER,
  CL_RANGES,
  PP_COLOR_DEPTH_CHANNELS,
  PP_RANGES,
  WB_KELVIN,
  WB_SHIFT_AXIS,
} from './constants';
import { MIRED_PER_SHIFT_STEP } from './color';
import { ppSettingsSchema } from './schema';

/** The PP setting keys, read off the schema rather than hand-listed. */
const ppKeys = Object.keys(ppSettingsSchema.shape);

describe('parameter explanations', () => {
  it('covers every Picture Profile setting', () => {
    expect(ppKeys.length).toBeGreaterThan(0);
    for (const key of ppKeys) {
      expect(PP_EXPLANATIONS, `missing explanation for PP "${key}"`).toHaveProperty(key);
    }
  });

  it('covers every Color Depth channel', () => {
    for (const c of PP_COLOR_DEPTH_CHANNELS) {
      expect(COLOR_DEPTH_EXPLANATIONS, `missing channel "${c}"`).toHaveProperty(c);
    }
  });

  it('covers every Picture Profile Detail sub-parameter', () => {
    for (const d of ['level', 'mode', 'vhBalance', 'bwBalance', 'limit', 'crispening', 'hiLightDetail']) {
      expect(PP_DETAIL_EXPLANATIONS, `missing detail sub-param "${d}"`).toHaveProperty(d);
    }
  });

  it('covers every Creative Look parameter', () => {
    for (const p of CL_PARAM_ORDER) {
      expect(CL_EXPLANATIONS, `missing CL param "${p}"`).toHaveProperty(p);
    }
  });

  it('has both locales filled in everywhere', () => {
    const tables = { PP_EXPLANATIONS, COLOR_DEPTH_EXPLANATIONS, PP_DETAIL_EXPLANATIONS, CL_EXPLANATIONS };
    for (const [name, table] of Object.entries(tables)) {
      for (const [key, value] of Object.entries(table)) {
        expect(value.en.length, `${name}.${key}.en`).toBeGreaterThan(20);
        expect(value.vi.length, `${name}.${key}.vi`).toBeGreaterThan(20);
      }
    }
  });

  it('warns about the two saturation ranges in both places', () => {
    // The single most confusable pair in the whole app. Read from constants.ts,
    // so a range change cannot leave the text stale and this test green.
    const pp = PP_RANGES.saturation;
    const cl = CL_RANGES.saturation;
    expect(PP_EXPLANATIONS.saturation.en).toContain(`${pp.min} to +${pp.max}`);
    expect(CL_EXPLANATIONS.saturation.en).toContain(`${cl.min} to +${cl.max}`);
    expect(PP_EXPLANATIONS.saturation.vi).toContain(`${pp.min} đến +${pp.max}`);
    expect(CL_EXPLANATIONS.saturation.vi).toContain(`${cl.min} đến +${cl.max}`);
  });

  it('names the end of the Kelvin range where the shift is the finer control', () => {
    // The overview had this backwards: at 9900K a 100K step is about 1 mired,
    // finer than any shift step, so the shift is finer only at the low end.
    const kelvinStep = (from: number, to: number) => Math.abs(1e6 / from - 1e6 / to);
    const atMin = kelvinStep(WB_KELVIN.min, WB_KELVIN.min + WB_KELVIN.step);
    const atMax = kelvinStep(WB_KELVIN.max - WB_KELVIN.step, WB_KELVIN.max);
    const shiftStep = WB_SHIFT_AXIS.step * MIRED_PER_SHIFT_STEP;
    expect(atMin).toBeGreaterThan(shiftStep);
    expect(atMax).toBeLessThan(shiftStep);

    const en = WB_OVERVIEW.en.join(' ');
    const vi = WB_OVERVIEW.vi.join(' ');
    expect(en).toContain(`the shift is the finer control down at ${WB_KELVIN.min}K and the coarser one up at ${WB_KELVIN.max}K`);
    expect(vi).toContain(`shift là nút tinh hơn ở vùng ${WB_KELVIN.min}K và thô hơn ở vùng ${WB_KELVIN.max}K`);
    expect(en).toContain(`about ${Math.round(atMin)} mired down at ${WB_KELVIN.min}K`);
    expect(en).toContain(`about ${Math.round(atMax)} mired up at ${WB_KELVIN.max}K`);
    expect(en).not.toContain('finer control at the warm end');
  });

  it('flags the unsigned Creative Look parameters', () => {
    for (const p of ['fade', 'sharpness', 'clarity'] as const) {
      expect(CL_EXPLANATIONS[p].en.toLowerCase(), p).toContain('never negative');
    }
    expect(CL_EXPLANATIONS.sharpnessRange.en).toContain('never negative');
  });

  it('names no Detail number that is not a bound of PP_RANGES.detailLevel', () => {
    /* The bands used to be typed in ('−7 to −3', '+1 to +7'), so a widened
       Detail range left the prose stale. Only the bounds, read from
       constants.ts, may appear. */
    const { min, max } = PP_RANGES.detailLevel;
    for (const text of [PP_EXPLANATIONS.detail.en, PP_EXPLANATIONS.detail.vi]) {
      const numbers = [...text.matchAll(/[−+-]?\d+/g)].map((m) => Number(m[0].replace('−', '-')));
      expect(numbers.length).toBeGreaterThan(0);
      for (const n of numbers) expect([min, max], text).toContain(n);
      expect(text).toContain(`${min}`);
      expect(text).toContain(`+${max}`);
    }
  });
});

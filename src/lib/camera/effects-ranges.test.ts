import { describe, expect, it, vi } from 'vitest';

/**
 * Rule 4: effect intensity follows the range in `constants.ts`, never a
 * threshold typed into `effects.ts`. The only way to prove that is to widen a
 * range and watch the wording move, so this file runs against widened ranges.
 * It is a file of its own because `vi.mock` replaces the module for every test
 * in the file.
 */
vi.mock('./constants', async (importOriginal) => {
  const real = await importOriginal<typeof import('./constants')>();
  return {
    ...real,
    WB_SHIFT_AXIS: { ...real.WB_SHIFT_AXIS, max: real.WB_SHIFT_AXIS.max * 2 },
    PP_RANGES: {
      ...real.PP_RANGES,
      kneeManualSlope: { ...real.PP_RANGES.kneeManualSlope, max: real.PP_RANGES.kneeManualSlope.max + 2 },
    },
  };
});

const { ppEffects, wbEffects, wbSummary } = await import('./effects');
const { shiftPosition } = await import('./color');
const { PP_RANGES, WB_SHIFT_AXIS } = await import('./constants');

const real = await vi.importActual<typeof import('./constants')>('./constants');

describe('intensity follows a widened range', () => {
  it('grades a shift against the throw, not against seven', () => {
    const a = (amount: number) =>
      wbEffects({ mode: 'kelvin', kelvin: 5500, shift: { ab: { axis: 'A', amount } } }).shiftAb.en;
    // The old full throw is now half of it.
    expect(a(real.WB_SHIFT_AXIS.max)).not.toContain('Full amber push');
    expect(a(WB_SHIFT_AXIS.max)).toContain('Full amber push');
  });

  it('grades the summary’s tint on the same scale as the row', () => {
    const gm = { axis: 'M' as const, amount: real.WB_SHIFT_AXIS.max };
    expect(wbSummary({ mode: 'kelvin', kelvin: 5500, shift: { gm } }).net.en).not.toContain('firm magenta');
    expect(wbSummary({ mode: 'kelvin', kelvin: 5500, shift: { gm: { ...gm, amount: WB_SHIFT_AXIS.max } } }).net.en)
      .toContain('firm magenta');
  });

  it('calls the knee off only at the top of its own slope range', () => {
    const knee = (slope: number) =>
      ppEffects({
        blackLevel: 0, gamma: 'Movie', blackGamma: { range: 'Middle', level: 0 },
        knee: { mode: 'Manual', point: 90, slope }, colorMode: 'Movie',
        saturation: 0, colorPhase: 0, colorDepth: { R: 0, G: 0, B: 0, C: 0, M: 0, Y: 0 },
        detail: { level: 0, mode: 'Auto', vhBalance: 0, bwBalance: 'Type3', limit: 0, crispening: 0, hiLightDetail: 0 },
      } as never).knee.en.toLowerCase();
    expect(knee(real.PP_RANGES.kneeManualSlope.max)).not.toContain('effectively off');
    expect(knee(PP_RANGES.kneeManualSlope.max)).toContain('effectively off');
  });

  it('puts the widened full throw on the edge of the shift plane', () => {
    const at = (amount: number) =>
      shiftPosition({ mode: 'kelvin', kelvin: 5500, shift: { ab: { axis: 'A', amount } } }).x;
    expect(at(WB_SHIFT_AXIS.max)).toBe(1);
    expect(at(real.WB_SHIFT_AXIS.max)).toBe(0.5);
  });
});

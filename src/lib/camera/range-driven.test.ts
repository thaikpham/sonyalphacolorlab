import { describe, expect, it, vi } from 'vitest';

/**
 * Rules 4 and 5: effect intensity and the ranges the help text states follow
 * `constants.ts`, never a number typed into `effects.ts` or `explanations.ts`.
 * The only way to prove that is to widen a range and watch the words move, so
 * this file runs against widened ranges. It is a file of its own because
 * `vi.mock` replaces the module for every test in the file.
 */
type Range = import('./constants').Range;
/** Two steps further out at each signed end, so no bound survives by accident. */
const widen = (r: Range): Range => ({ ...r, min: r.min < 0 ? r.min - 2 : r.min, max: r.max + 2 });
const widenAll = <T extends Record<string, Range>>(t: T): T =>
  Object.fromEntries(Object.entries(t).map(([k, r]) => [k, widen(r)])) as T;

vi.mock('./constants', async (importOriginal) => {
  const real = await importOriginal<typeof import('./constants')>();
  return {
    ...real,
    WB_SHIFT_AXIS: { ...real.WB_SHIFT_AXIS, max: real.WB_SHIFT_AXIS.max * 2 },
    PP_RANGES: widenAll(real.PP_RANGES),
    CL_RANGES: widenAll(real.CL_RANGES),
  };
});

const { ppEffects, wbEffects, wbSummary } = await import('./effects');
const { shiftPosition } = await import('./color');
const { CL_EXPLANATIONS, PP_DETAIL_EXPLANATIONS, PP_EXPLANATIONS, WB_EXPLANATIONS } = await import('./explanations');
const { CL_RANGES, PP_RANGES, WB_SHIFT_AXIS } = await import('./constants');

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

describe('help text states the ranges constants.ts holds', () => {
  /** How the text writes a bound: signed ranges carry an explicit +. */
  const bound = (r: Range, n: number) => (r.min < 0 && n > 0 ? `+${n}` : String(n));

  const stated: [string, { en: string; vi: string }, Range][] = [
    ['Black Gamma level', PP_EXPLANATIONS.blackGamma, PP_RANGES.blackGammaLevel],
    ['Knee point', PP_EXPLANATIONS.knee, PP_RANGES.kneeManualPoint],
    ['Knee slope', PP_EXPLANATIONS.knee, PP_RANGES.kneeManualSlope],
    ['PP saturation', PP_EXPLANATIONS.saturation, PP_RANGES.saturation],
    ['Detail level', PP_DETAIL_EXPLANATIONS.level, PP_RANGES.detailLevel],
    ['V/H balance', PP_DETAIL_EXPLANATIONS.vhBalance, PP_RANGES.detailVhBalance],
    ['Limit', PP_DETAIL_EXPLANATIONS.limit, PP_RANGES.detailLimit],
    ['Crispening', PP_DETAIL_EXPLANATIONS.crispening, PP_RANGES.detailCrispening],
    ['Hi-Light Detail', PP_DETAIL_EXPLANATIONS.hiLightDetail, PP_RANGES.detailHiLightDetail],
    ['CL saturation', CL_EXPLANATIONS.saturation, CL_RANGES.saturation],
    ['Sharpness Range', CL_EXPLANATIONS.sharpnessRange, CL_RANGES.sharpnessRange],
  ];

  it.each(stated)('%s states the widened bounds in both locales', (_name, text, range) => {
    for (const locale of ['en', 'vi'] as const) {
      expect(text[locale]).toContain(bound(range, range.min));
      expect(text[locale]).toContain(bound(range, range.max));
    }
  });

  it('states the shift grid’s throw and step in both locales', () => {
    expect(WB_EXPLANATIONS.shiftAb.en).toContain(`Up to ${WB_SHIFT_AXIS.max} each way, in ${WB_SHIFT_AXIS.step} steps`);
    expect(WB_EXPLANATIONS.shiftAb.vi).toContain(`Tối đa ${WB_SHIFT_AXIS.max} mỗi phía`);
    expect(WB_EXPLANATIONS.shiftAb.vi).toContain(String(WB_SHIFT_AXIS.step).replace('.', ','));
  });
});

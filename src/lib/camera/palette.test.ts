import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  CHANNEL_HUE,
  WB_HUE,
  accentFor,
  accentHex,
  gamutMap,
  inSrgb,
  oklchToHex,
  wbBalance,
  type AccentInput,
} from './color';
import {
  CL_RANGES,
  CREATIVE_LOOK_CODES,
  PP_BLACK_GAMMA_RANGE,
  PP_COLOR_DEPTH_CHANNELS,
  PP_DETAIL_BW_BALANCE,
  PP_RANGES,
  WB_KELVIN,
  WB_SHIFT_AXIS,
  type Range,
} from './constants';
import { DAYLIGHT_K, PALETTE_WEIGHTS, REFERENCE, SWATCH_IDS, paletteFor, type Palette, type SwatchId } from './palette';
import type { ClSettings, PpSettings, Recipe, WhiteBalance } from './schema';

/**
 * The palette is a reading of the settings in Sony's documented directions,
 * with magnitudes that are neutral defaults (`PALETTE_WEIGHTS`). These tests
 * pin direction, order and legibility bands — never a number — so refitting
 * the weights from the a7 IV ColorChecker shoot does not fight them.
 */

const recipes = JSON.parse(readFileSync('data/recipes.seed.json', 'utf8')) as Recipe[];

const NEUTRAL_WB: WhiteBalance = { mode: 'kelvin', kelvin: 5500 };

const NEUTRAL_PP_SETTINGS: PpSettings = {
  blackLevel: 0,
  gamma: 'Movie',
  blackGamma: { range: 'Middle', level: 0 },
  knee: { mode: 'Manual', point: 100, slope: PP_RANGES.kneeManualSlope.max },
  colorMode: 'Movie',
  saturation: 0,
  colorPhase: 0,
  colorDepth: { R: 0, G: 0, B: 0, C: 0, M: 0, Y: 0 },
  detail: { level: 0, mode: 'Manual', vhBalance: 0, bwBalance: 'Type3', limit: 0, crispening: 0, hiLightDetail: 0 },
};

const NEUTRAL_CL_SETTINGS: ClSettings = {
  look: 'ST',
  contrast: 0,
  highlights: 0,
  shadows: 0,
  fade: 0,
  saturation: 0,
  sharpness: 0,
  sharpnessRange: 3,
  clarity: 0,
};

const NEUTRAL_PP: AccentInput = { format: 'pp', whiteBalance: NEUTRAL_WB, settings: NEUTRAL_PP_SETTINGS };
const NEUTRAL_CL: AccentInput = { format: 'cl', whiteBalance: NEUTRAL_WB, settings: NEUTRAL_CL_SETTINGS };

const pp = (settings: Partial<PpSettings>, whiteBalance: WhiteBalance = NEUTRAL_WB): AccentInput => ({
  format: 'pp',
  whiteBalance,
  settings: { ...NEUTRAL_PP_SETTINGS, ...settings },
});

const cl = (settings: Partial<ClSettings>, whiteBalance: WhiteBalance = NEUTRAL_WB): AccentInput => ({
  format: 'cl',
  whiteBalance,
  settings: { ...NEUTRAL_CL_SETTINGS, ...settings },
});

/** Every legal value of a range, in steps, from the bound in `constants.ts`. */
function sweep(range: Range): number[] {
  const n = Math.round((range.max - range.min) / range.step);
  return Array.from({ length: n + 1 }, (_, i) => Number((range.min + i * range.step).toFixed(6)));
}

const swatch = (p: Palette, id: SwatchId) => {
  const s = p.find((x) => x.id === id);
  if (!s) throw new Error(`no ${id}`);
  return s;
};

const hueGap = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
};

/** Signed shortest turn from `a` to `b`, degrees. */
const hueTurn = (a: number, b: number) => ((((b - a) % 360) + 540) % 360) - 180;

const EPS = 1e-9;

function expectNonDecreasing(values: number[], label: string) {
  for (let i = 1; i < values.length; i++) {
    expect(values[i], `${label} step ${i}`).toBeGreaterThanOrEqual(values[i - 1] - EPS);
  }
  expect(values.at(-1)!, `${label} max vs min`).toBeGreaterThan(values[0]);
}

function expectNonIncreasing(values: number[], label: string) {
  expectNonDecreasing(values.map((v) => -v), label);
}

const CHROMATIC: SwatchId[] = SWATCH_IDS.filter((id) => REFERENCE[id].c > 0);
const NEUTRALS: SwatchId[] = SWATCH_IDS.filter((id) => REFERENCE[id].c === 0);

const meanChroma = (p: Palette) => CHROMATIC.reduce((sum, id) => sum + swatch(p, id).c, 0) / CHROMATIC.length;

// ---------------------------------------------------------------------------

describe('hex emitter', () => {
  /* Fixed points of the OKLab ↔ sRGB transform (Ottosson's published values
     for the sRGB primaries), so a broken matrix or transfer function fails
     here rather than shifting every swatch and accent together. */
  it('lands the sRGB primaries, white and black on their own hex', () => {
    expect(oklchToHex({ l: 1, c: 0, h: 0 })).toBe('#ffffff');
    expect(oklchToHex({ l: 0, c: 0, h: 0 })).toBe('#000000');
    expect(oklchToHex({ l: 0.627955, c: 0.257683, h: 29.2339 })).toBe('#ff0000');
    expect(oklchToHex({ l: 0.86644, c: 0.294827, h: 142.4953 })).toBe('#00ff00');
    expect(oklchToHex({ l: 0.452014, c: 0.313214, h: 264.052 })).toBe('#0000ff');
    /* And the accent goes through the same emitter, so the share card's
       colours cannot drift from the grid's. */
    expect(accentHex({ l: 0.627955, c: 0.257683, h: 29.2339 })).toBe('#ff0000');
  });

  it('maps an out-of-gamut colour into sRGB by chroma alone', () => {
    const wild = { l: 0.58, c: 0.4, h: 28 };
    expect(inSrgb(wild)).toBe(false);
    const mapped = gamutMap(wild);
    expect(inSrgb(mapped)).toBe(true);
    expect(mapped.l).toBe(wild.l);
    expect(mapped.h).toBe(wild.h);
    expect(mapped.c).toBeGreaterThan(0);
    expect(mapped.c).toBeLessThan(wild.c);
  });

  it('leaves an in-gamut colour alone', () => {
    const grey = { l: 0.6, c: 0, h: 0 };
    expect(gamutMap(grey)).toEqual(grey);
  });
});

describe('palette identity', () => {
  it('returns the references, in order, for a neutral Picture Profile and a neutral Creative Look', () => {
    for (const neutral of [NEUTRAL_PP, NEUTRAL_CL]) {
      const p = paletteFor(neutral);
      expect(p.map((s) => s.id)).toEqual([...SWATCH_IDS]);
      for (const s of p) {
        expect(s.l, s.id).toBeCloseTo(REFERENCE[s.id].l, 6);
        expect(s.c, s.id).toBeCloseTo(REFERENCE[s.id].c, 6);
        expect(s.h, s.id).toBeCloseTo(REFERENCE[s.id].h, 6);
      }
    }
  });
});

describe('one-dial sweeps, in the documented direction', () => {
  it('Black Level up lifts the shadow (positive weakens black)', () => {
    const values = sweep(PP_RANGES.blackLevel).map((v) => swatch(paletteFor(pp({ blackLevel: v })), 'shadow').l);
    expectNonDecreasing(values, 'shadow L');
  });

  it('Black Gamma level up lifts the shadow, and reaches further Narrow → Middle → Wide', () => {
    for (const range of PP_BLACK_GAMMA_RANGE) {
      const values = sweep(PP_RANGES.blackGammaLevel).map(
        (level) => swatch(paletteFor(pp({ blackGamma: { range, level } })), 'shadow').l,
      );
      expectNonDecreasing(values, `${range} shadow L`);
    }
    const top = PP_RANGES.blackGammaLevel.max;
    const lift = (range: (typeof PP_BLACK_GAMMA_RANGE)[number]) =>
      swatch(paletteFor(pp({ blackGamma: { range, level: top } })), 'shadow').l - REFERENCE.shadow.l;
    expect(lift('Narrow')).toBeLessThan(lift('Middle'));
    expect(lift('Middle')).toBeLessThan(lift('Wide'));
  });

  it('Knee: a lower point compresses the highlight; slope at its maximum is off', () => {
    const values = sweep(PP_RANGES.kneeManualPoint).map(
      (point) => swatch(paletteFor(pp({ knee: { mode: 'Manual', point, slope: 0 } })), 'highlight').l,
    );
    expectNonDecreasing(values, 'highlight L against point');
    for (const point of sweep(PP_RANGES.kneeManualPoint)) {
      const off = paletteFor(pp({ knee: { mode: 'Manual', point, slope: PP_RANGES.kneeManualSlope.max } }));
      expect(swatch(off, 'highlight').l, `point ${point}`).toBeCloseTo(REFERENCE.highlight.l, 9);
    }
  });

  it('Knee: a gentler (lower) slope compresses more', () => {
    const point = PP_RANGES.kneeManualPoint.min;
    const values = sweep(PP_RANGES.kneeManualSlope).map(
      (slope) => swatch(paletteFor(pp({ knee: { mode: 'Manual', point, slope } })), 'highlight').l,
    );
    expectNonDecreasing(values, 'highlight L against slope');
  });

  it('Saturation up raises chroma, and PP and CL meet at both ends of their own ranges', () => {
    /* Skin, not red: red sits near the sRGB edge and is gamut-capped from half
       range up, so a red comparison at the top would pass whatever the two
       laws did. Skin (C 0.09) stays inside sRGB across both ranges, so the
       sweep must rise strictly and the two ends must genuinely meet. */
    const ppSkin = sweep(PP_RANGES.saturation).map((v) => swatch(paletteFor(pp({ saturation: v })), 'skin').c);
    const clSkin = sweep(CL_RANGES.saturation).map((v) => swatch(paletteFor(cl({ saturation: v })), 'skin').c);
    for (const [label, values] of [['PP', ppSkin], ['CL', clSkin]] as const) {
      for (let i = 1; i < values.length; i++) {
        expect(values[i], `${label} skin C step ${i}`).toBeGreaterThan(values[i - 1]);
      }
    }
    expect(ppSkin.at(-1)!).toBeGreaterThan(REFERENCE.skin.c);
    expect(Math.abs(ppSkin.at(-1)! - clSkin.at(-1)!)).toBeLessThanOrEqual(1e-3);
    expect(Math.abs(ppSkin[0] - clSkin[0])).toBeLessThanOrEqual(1e-3);
    expect(inSrgb({ l: REFERENCE.skin.l, c: ppSkin.at(-1)!, h: REFERENCE.skin.h })).toBe(true);
  });

  /* The cast comes first and the colour dials act on it, as on the camera
     (white balance before the matrix): a desaturated recipe shows a weaker
     cast, and Color Phase turns a cast on the neutrals as it turns every hue
     (Sony: Phase "affects all colors"). Under a neutral white balance the mid
     has no hue to turn, so these run under an amber shift. */
  it('Saturation down weakens a white-balance cast on the neutrals', () => {
    const amber: WhiteBalance = { mode: 'kelvin', kelvin: 5500, shift: { ab: { axis: 'A', amount: WB_SHIFT_AXIS.max } } };
    const at = (saturation: number) => swatch(paletteFor(pp({ saturation }, amber)), 'mid').c;
    expect(at(0)).toBeGreaterThan(0);
    expect(at(PP_RANGES.saturation.min)).toBeLessThan(at(0));
    expect(at(PP_RANGES.saturation.max)).toBeGreaterThan(at(0));
  });

  it('Color Phase turns a white-balance cast on the neutrals the same way it turns skin', () => {
    const amber: WhiteBalance = { mode: 'kelvin', kelvin: 5500, shift: { ab: { axis: 'A', amount: WB_SHIFT_AXIS.max } } };
    const mid = (colorPhase: number) => swatch(paletteFor(pp({ colorPhase }, amber)), 'mid').h;
    const skin = (colorPhase: number) => swatch(paletteFor(pp({ colorPhase }, amber)), 'skin').h;
    const max = PP_RANGES.colorPhase.max;
    expect(hueTurn(mid(0), mid(max))).toBeLessThan(0);
    expect(hueTurn(mid(0), mid(-max))).toBeGreaterThan(0);
    expect(Math.sign(hueTurn(skin(0), skin(max)))).toBe(Math.sign(hueTurn(mid(0), mid(max))));
  });

  it('Color Phase up turns skin towards red by the same amount per unit, and leaves a neutral mid neutral', () => {
    const values = sweep(PP_RANGES.colorPhase).map((v) => paletteFor(pp({ colorPhase: v })));
    const turns = values.slice(1).map((p, i) => hueTurn(swatch(values[i], 'skin').h, swatch(p, 'skin').h));
    for (const t of turns) {
      expect(t).toBeLessThan(0);
      expect(t).toBeCloseTo(turns[0], 6);
    }
    for (const p of values) expect(swatch(p, 'mid')).toEqual(swatch(paletteFor(NEUTRAL_PP), 'mid'));
  });

  it('Color Depth up deepens the nearest hue (lower L, more C) and never touches the neutral ramp', () => {
    const neutral = paletteFor(NEUTRAL_PP);
    for (const channel of PP_COLOR_DEPTH_CHANNELS) {
      const nearest = CHROMATIC.reduce((a, b) =>
        hueGap(REFERENCE[a].h, CHANNEL_HUE[channel]) <= hueGap(REFERENCE[b].h, CHANNEL_HUE[channel]) ? a : b,
      );
      const values = sweep(PP_RANGES.colorDepth);
      const palettes = values.map((v) =>
        paletteFor(pp({ colorDepth: { ...NEUTRAL_PP_SETTINGS.colorDepth, [channel]: v } })),
      );
      expectNonIncreasing(palettes.map((p) => swatch(p, nearest).l), `${channel} → ${nearest} L`);
      // Chroma against neutral, not step by step: red and yellow start close
      // to the sRGB edge, and the edge falls with L, so near +7 the gamut map
      // — not the model — caps them. Deeper still holds at every plus value.
      const ref = swatch(neutral, nearest).c;
      values.forEach((v, i) => {
        const c = swatch(palettes[i], nearest).c;
        const label = `${channel} ${v} → ${nearest} C`;
        if (v > 0) expect(c, label).toBeGreaterThan(ref);
        else if (v < 0) expect(c, label).toBeLessThan(ref);
        else expect(c, label).toBe(ref);
      });
      for (const p of palettes) {
        for (const id of NEUTRALS) expect(swatch(p, id), `${channel} ${id}`).toEqual(swatch(neutral, id));
      }
    }
  });

  it('CL Contrast up spreads the ramp: shadow down, highlight up', () => {
    const palettes = sweep(CL_RANGES.contrast).map((v) => paletteFor(cl({ contrast: v })));
    expectNonIncreasing(palettes.map((p) => swatch(p, 'shadow').l), 'shadow L');
    expectNonDecreasing(palettes.map((p) => swatch(p, 'highlight').l), 'highlight L');
  });

  it('CL Highlights up lifts the highlight only', () => {
    const palettes = sweep(CL_RANGES.highlights).map((v) => paletteFor(cl({ highlights: v })));
    expectNonDecreasing(palettes.map((p) => swatch(p, 'highlight').l), 'highlight L');
    for (const p of palettes) expect(swatch(p, 'shadow').l).toBe(REFERENCE.shadow.l);
  });

  it('CL Shadows up lifts the shadow only', () => {
    const palettes = sweep(CL_RANGES.shadows).map((v) => paletteFor(cl({ shadows: v })));
    expectNonDecreasing(palettes.map((p) => swatch(p, 'shadow').l), 'shadow L');
    for (const p of palettes) expect(swatch(p, 'highlight').l).toBe(REFERENCE.highlight.l);
  });

  it('CL Fade up lifts the blacks, dims the whites and lowers chroma', () => {
    const palettes = sweep(CL_RANGES.fade).map((v) => paletteFor(cl({ fade: v })));
    expectNonDecreasing(palettes.map((p) => swatch(p, 'shadow').l), 'shadow L');
    expectNonIncreasing(palettes.map((p) => swatch(p, 'highlight').l), 'highlight L');
    expectNonIncreasing(palettes.map((p) => swatch(p, 'red').c), 'red C');
  });

  it('a higher Kelvin warms the mid along amber', () => {
    const kelvins = sweep({ min: 5500, max: WB_KELVIN.max, step: WB_KELVIN.step });
    const mids = kelvins.map((kelvin) => swatch(paletteFor(pp({}, { mode: 'kelvin', kelvin })), 'mid'));
    expectNonDecreasing(mids.map((m) => m.c), 'mid C');
    for (const m of mids.filter((x) => x.c > 0)) expect(hueGap(m.h, WB_HUE.amber)).toBeLessThanOrEqual(20);
  });

  it('each shift axis casts the mid towards its own hue', () => {
    const full = WB_SHIFT_AXIS.max;
    const cases: [WhiteBalance['shift'], number][] = [
      [{ ab: { axis: 'A', amount: full } }, WB_HUE.amber],
      [{ ab: { axis: 'B', amount: full } }, WB_HUE.blue],
      [{ gm: { axis: 'M', amount: full } }, WB_HUE.magenta],
      [{ gm: { axis: 'G', amount: full } }, WB_HUE.green],
    ];
    for (const [shift, hue] of cases) {
      const mid = swatch(paletteFor(pp({}, { mode: 'kelvin', kelvin: 5500, shift })), 'mid');
      expect(mid.c, JSON.stringify(shift)).toBeGreaterThan(0);
      expect(hueGap(mid.h, hue), JSON.stringify(shift)).toBeLessThanOrEqual(20);
    }
  });

  it('an amber shift pulls back a cold Kelvin', () => {
    const cold = { mode: 'kelvin', kelvin: WB_KELVIN.min } as const;
    const pulled = { ...cold, shift: { ab: { axis: 'A', amount: WB_SHIFT_AXIS.max } } } as const;
    expect(swatch(paletteFor(pp({}, pulled)), 'mid').c).toBeLessThan(swatch(paletteFor(pp({}, cold)), 'mid').c);
  });

  it('Auto White Balance and presets paint only their shift', () => {
    const awb = paletteFor(pp({}, { mode: 'auto', auto: 'AWB' }));
    const preset = paletteFor(pp({}, { mode: 'preset', preset: 'Cloudy' }));
    expect(awb).toEqual(paletteFor(NEUTRAL_PP));
    expect(preset).toEqual(paletteFor(NEUTRAL_PP));
    const shifted = paletteFor(pp({}, { mode: 'preset', preset: 'Cloudy', shift: { ab: { axis: 'A', amount: 2 } } }));
    expect(swatch(shifted, 'mid').c).toBeGreaterThan(0);
  });
});

describe('gamma and colour mode, in the documented directions', () => {
  // TP0000909109: Cine1 soft darks and subdued colour, Cine2 the same within
  // 100%; Cine3 more contrast and black gradation, Cine4 more dark contrast
  // still; S-Cinetone soft colour; S-Log and the S-Gamut family flat before
  // grading. The colour mode stays Movie while the gamma moves, and the
  // gamma stays Movie while the colour mode moves.
  const gammaOf = (gamma: PpSettings['gamma']) => paletteFor(pp({ gamma }));
  const modeOf = (colorMode: PpSettings['colorMode']) => paletteFor(pp({ colorMode }));
  const movie = paletteFor(NEUTRAL_PP);

  it('softens the darks and subdues colour on Cine1 and Cine2', () => {
    for (const gamma of ['Cine1', 'Cine2'] as const) {
      expect(swatch(gammaOf(gamma), 'shadow').l, gamma).toBeGreaterThan(swatch(movie, 'shadow').l);
      expect(meanChroma(gammaOf(gamma)), gamma).toBeLessThan(meanChroma(movie));
    }
  });

  it('deepens the darks from Cine1 to Cine3 to Cine4', () => {
    expect(swatch(gammaOf('Cine3'), 'shadow').l).toBeLessThan(swatch(gammaOf('Cine1'), 'shadow').l);
    expect(swatch(gammaOf('Cine4'), 'shadow').l).toBeLessThan(swatch(gammaOf('Cine3'), 'shadow').l);
  });

  it('lays S-Log flat: lighter shadow, lower highlight and less chroma than any non-log gamma', () => {
    const others = ['Movie', 'Still', 'Cine1', 'Cine2', 'Cine3', 'Cine4', 'S-Cinetone', 'ITU709'] as const;
    for (const log of ['S-Log2', 'S-Log3'] as const) {
      const p = gammaOf(log);
      for (const gamma of others) {
        const o = gammaOf(gamma);
        expect(swatch(p, 'shadow').l, `${log} vs ${gamma} shadow`).toBeGreaterThan(swatch(o, 'shadow').l);
        expect(swatch(p, 'highlight').l, `${log} vs ${gamma} highlight`).toBeLessThan(swatch(o, 'highlight').l);
        expect(meanChroma(p), `${log} vs ${gamma} chroma`).toBeLessThan(meanChroma(o));
      }
    }
  });

  it('gives S-Cinetone soft colour, as gamma and as colour mode', () => {
    expect(meanChroma(gammaOf('S-Cinetone'))).toBeLessThan(meanChroma(movie));
    expect(meanChroma(modeOf('S-Cinetone'))).toBeLessThan(meanChroma(movie));
  });

  it('holds Cinema and the S-Gamut family below Movie colour', () => {
    for (const mode of ['Cinema', 'S-Gamut', 'S-Gamut3', 'S-Gamut3.Cine'] as const) {
      expect(meanChroma(modeOf(mode)), mode).toBeLessThan(meanChroma(movie));
    }
    for (const mode of ['S-Gamut', 'S-Gamut3', 'S-Gamut3.Cine'] as const) {
      expect(meanChroma(modeOf(mode)), mode).toBeLessThan(meanChroma(modeOf('Cinema')));
    }
  });
});

describe('Knee Auto', () => {
  it('rolls the highlight off on Movie and ITU709', () => {
    for (const gamma of ['Movie', 'ITU709'] as const) {
      const auto = paletteFor(pp({ gamma, knee: { mode: 'Auto' } }));
      const off = paletteFor(pp({ gamma }));
      expect(swatch(auto, 'highlight').l, gamma).toBeLessThan(swatch(off, 'highlight').l);
    }
  });

  it('is Knee off on every other gamma, ITU709(800%) included', () => {
    for (const gamma of ['Cine1', 'ITU709(800%)', 'S-Cinetone', 'S-Log3', 'HLG2'] as const) {
      const auto = paletteFor(pp({ gamma, knee: { mode: 'Auto' } }));
      const off = paletteFor(pp({ gamma }));
      expect(auto, gamma).toEqual(off);
    }
  });
});

describe('monochrome', () => {
  const withShift = (r: Recipe): AccentInput =>
    ({
      ...r,
      whiteBalance: { ...r.whiteBalance, shift: { ab: { axis: 'A', amount: WB_SHIFT_AXIS.max } } },
    }) as AccentInput;

  it('paints every Black & White recipe without chroma, even under a shift', () => {
    const bw = recipes.filter(
      (r) => (r.format === 'pp' && r.settings.colorMode === 'Black & White') || (r.format === 'cl' && r.settings.look === 'BW'),
    );
    expect(bw.length).toBeGreaterThan(0);
    for (const r of bw) {
      for (const input of [r, withShift(r)]) {
        for (const s of paletteFor(input)) expect(s.c, `${r.id} ${s.id}`).toBe(0);
      }
    }
    for (const s of paletteFor(pp({ colorMode: 'Black & White', saturation: PP_RANGES.saturation.max }))) {
      expect(s.c, s.id).toBe(0);
    }
    for (const s of paletteFor(cl({ look: 'BW', saturation: undefined }))) expect(s.c, s.id).toBe(0);
  });

  it('paints every Sepia recipe in one warm hue — the accent\'s sepia, not the White Balance', () => {
    const sepia = recipes.filter((r) => r.format === 'cl' && r.settings.look === 'SE');
    expect(sepia.length).toBeGreaterThan(0);
    for (const r of sepia) {
      // The accent is the one other reading of a sepia recipe; the two agree.
      const accent = accentFor(r);
      expect(hueGap(accent.h, WB_HUE.amber), `${r.id} accent`).toBeLessThanOrEqual(20);
      for (const input of [r, withShift(r)]) {
        for (const s of paletteFor(input)) {
          expect(hueGap(s.h, accent.h), `${r.id} ${s.id}`).toBeLessThanOrEqual(3);
          expect(s.c, `${r.id} ${s.id}`).toBeGreaterThan(0);
          expect(s.c, `${r.id} ${s.id}`).toBeLessThanOrEqual(accent.c + 0.001);
        }
      }
    }
  });
});

describe('not painted', () => {
  it('ignores every Detail field — a flat patch has no edge', () => {
    const base = paletteFor(NEUTRAL_PP);
    const d = NEUTRAL_PP_SETTINGS.detail;
    const variants: PpSettings['detail'][] = [
      ...sweep(PP_RANGES.detailLevel).map((level) => ({ ...d, level })),
      ...sweep(PP_RANGES.detailVhBalance).map((vhBalance) => ({ ...d, vhBalance })),
      ...sweep(PP_RANGES.detailLimit).map((limit) => ({ ...d, limit })),
      ...sweep(PP_RANGES.detailCrispening).map((crispening) => ({ ...d, crispening })),
      ...sweep(PP_RANGES.detailHiLightDetail).map((hiLightDetail) => ({ ...d, hiLightDetail })),
      ...PP_DETAIL_BW_BALANCE.map((bwBalance) => ({ ...d, bwBalance })),
      { ...d, mode: 'Auto' as const },
    ];
    for (const detail of variants) expect(paletteFor(pp({ detail })), JSON.stringify(detail)).toEqual(base);
  });

  it('ignores Creative Look Sharpness, Sharpness Range and Clarity', () => {
    const base = paletteFor(NEUTRAL_CL);
    for (const sharpness of sweep(CL_RANGES.sharpness)) expect(paletteFor(cl({ sharpness }))).toEqual(base);
    for (const sharpnessRange of sweep(CL_RANGES.sharpnessRange)) expect(paletteFor(cl({ sharpnessRange }))).toEqual(base);
    for (const clarity of sweep(CL_RANGES.clarity)) expect(paletteFor(cl({ clarity }))).toEqual(base);
  });
});

describe('Creative Look bases', () => {
  const bare = (look: (typeof CREATIVE_LOOK_CODES)[number]) =>
    paletteFor(cl({ look, saturation: look === 'BW' || look === 'SE' ? undefined : 0 }));

  it('orders the Looks by chroma as their names say: VV2 > VV > ST > NT', () => {
    expect(meanChroma(bare('VV2'))).toBeGreaterThan(meanChroma(bare('VV')));
    expect(meanChroma(bare('VV'))).toBeGreaterThan(meanChroma(bare('ST')));
    expect(meanChroma(bare('ST'))).toBeGreaterThan(meanChroma(bare('NT')));
  });

  it('gives Soft Highkey the lightest shadow of any Look', () => {
    const sh = swatch(bare('SH'), 'shadow').l;
    for (const look of CREATIVE_LOOK_CODES.filter((l) => l !== 'SH')) {
      expect(sh, look).toBeGreaterThan(swatch(bare(look), 'shadow').l);
    }
  });

  it('holds Film\'s highlight below Standard\'s', () => {
    expect(swatch(bare('FL'), 'highlight').l).toBeLessThan(swatch(bare('ST'), 'highlight').l);
  });
});

describe('bounds and light', () => {
  /* No seed recipe is dark enough to reach the floor, so this one is built to:
     every darkening dial at its bound. Without the clamp its shadow would sit
     below the page's own ground and read as a hole in the card. */
  it('holds the shadow at the floor when every darkening dial is at its bound', () => {
    const darkest = paletteFor(
      pp({
        gamma: 'Cine4',
        colorMode: 'Still',
        blackLevel: PP_RANGES.blackLevel.min,
        blackGamma: { range: 'Wide', level: PP_RANGES.blackGammaLevel.min },
      }),
    );
    expect(swatch(darkest, 'shadow').l).toBe(PALETTE_WEIGHTS.bounds.lMin);
  });

  /* A Kelvin setting reads warmer under a lower light: the same 4000K that
     cools a daylight scene warms one lit by 3000K bulbs. AWB and the presets
     publish no Kelvin, so the light the recipe is built for cannot move them. */
  it('reads a Kelvin recipe under the light it is built for, and leaves AWB alone', () => {
    const lean = (p: Palette) => {
      const mid = swatch(p, 'mid');
      return mid.c * Math.cos(((mid.h - WB_HUE.amber) * Math.PI) / 180);
    };
    const kelvin = pp({}, { mode: 'kelvin', kelvin: 4000 });
    expect(lean(paletteFor(kelvin))).toBeLessThan(0);
    expect(lean(paletteFor(kelvin, { light: 3000 }))).toBeGreaterThan(0);
    expect(paletteFor(kelvin, { light: DAYLIGHT_K })).toEqual(paletteFor(kelvin));

    const awb = pp({}, { mode: 'auto', auto: 'AWB', shift: { ab: { axis: 'A', amount: 2 } } });
    expect(paletteFor(awb, { light: 3000 })).toEqual(paletteFor(awb));
  });
});

// ---------------------------------------------------------------------------

describe('every seed recipe', () => {
  const palettes = recipes.map((r) => [r, paletteFor(r)] as const);

  it('stays in the legibility band, in sRGB', () => {
    for (const [r, p] of palettes) {
      expect(swatch(p, 'highlight').l, `${r.id} highlight`).toBeGreaterThanOrEqual(0.7);
      expect(swatch(p, 'shadow').l, `${r.id} shadow vs mid`).toBeLessThanOrEqual(swatch(p, 'mid').l - 0.06);
      expect(p.filter((s) => s.l >= 0.5).length, `${r.id} light swatches`).toBeGreaterThanOrEqual(3);
      for (const s of p) {
        expect(s.l, `${r.id} ${s.id}`).toBeGreaterThanOrEqual(PALETTE_WEIGHTS.bounds.lMin);
        expect(s.l, `${r.id} ${s.id}`).toBeLessThanOrEqual(PALETTE_WEIGHTS.bounds.lMax);
        expect(inSrgb(s), `${r.id} ${s.id}`).toBe(true);
      }
    }
  });

  it('emits css and hex from the same mapped value', () => {
    const CSS_RE = /^oklch\((\d+(\.\d+)?)% ([\d.]+) ([\d.]+)\)$/;
    for (const [r, p] of palettes) {
      for (const s of p) {
        const m = CSS_RE.exec(s.css);
        expect(m, `${r.id} ${s.id} ${s.css}`).not.toBeNull();
        expect(Number(m![1]) / 100).toBeCloseTo(s.l, 9);
        expect(Number(m![3])).toBeCloseTo(s.c, 9);
        expect(Number(m![4])).toBeCloseTo(s.h, 9);
        expect(s.hex).toBe(oklchToHex(s));
        expect(deltaEOk(hexToOklab(s.hex), oklchToOklab(s)), `${r.id} ${s.id}`).toBeLessThanOrEqual(0.01);
      }
    }
  });

  it('never gives two recipes with different painted settings the same palette', () => {
    const differs = (a: Palette, b: Palette) =>
      a.some((s, i) => Math.abs(s.l - b[i].l) > 1e-4 || Math.abs(s.c - b[i].c) > 1e-4 || Math.abs(s.h - b[i].h) > 1e-4);
    for (let i = 0; i < palettes.length; i++) {
      for (let j = i + 1; j < palettes.length; j++) {
        const [a, pa] = palettes[i];
        const [b, pb] = palettes[j];
        if (paintedKey(a) === paintedKey(b)) continue;
        expect(differs(pa, pb), `${a.id} vs ${b.id}`).toBe(true);
      }
    }
  });
});

describe('source hygiene', () => {
  it('has no hex literal in palette.ts — hex comes only from the emitter', () => {
    expect(readFileSync('src/lib/camera/palette.ts', 'utf8')).not.toMatch(/#[0-9a-fA-F]/);
  });
});

// ---------------------------------------------------------------------------

/**
 * What the palette reads from a recipe. Detail, sharpness, sharpness range
 * and clarity are not painted; White Balance is read only as its warmth and
 * tint, so two Auto modes with the same shift are the same input.
 */
function paintedKey(r: Recipe): string {
  const { warmth, tint } = wbBalance(r.whiteBalance);
  const wb = { warmth: Number(warmth.toFixed(6)), tint: Number(tint.toFixed(6)) };
  if (r.format === 'pp') {
    const { detail: _detail, knee, ...rest } = r.settings;
    const kneeKey = knee.mode === 'Auto' ? { mode: 'Auto' } : knee;
    return JSON.stringify({ format: 'pp', wb, ...rest, knee: kneeKey });
  }
  const { sharpness: _s, sharpnessRange: _r, clarity: _c, ...rest } = r.settings;
  return JSON.stringify({ format: 'cl', wb, ...rest });
}

function oklchToOklab(s: { l: number; c: number; h: number }): [number, number, number] {
  const r = (s.h * Math.PI) / 180;
  return [s.l, s.c * Math.cos(r), s.c * Math.sin(r)];
}

function hexToOklab(hex: string): [number, number, number] {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function deltaEOk(a: [number, number, number], b: [number, number, number]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

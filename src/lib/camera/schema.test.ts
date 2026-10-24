import { describe, expect, it } from 'vitest';
import {
  clSettingsSchema,
  ppSettingsSchema,
  RECIPE_ID_RE,
  RECIPE_ID_TRANSITION_RE,
  recipeSchema,
  whiteBalanceSchema,
} from './schema';
import { formatClValue, formatWhiteBalance, parseWhiteBalance } from './format';
import {
  CL_MONOCHROME_LOOKS,
  CL_RANGES,
  CREATIVE_LOOK_CODES,
  PP_GAMMA,
  PP_RANGES,
  WB_KELVIN,
  WB_SHIFT_AXIS,
  type Range,
} from './constants';

const wb = { mode: 'kelvin', kelvin: 7000, shift: { ab: { axis: 'B', amount: 3 }, gm: { axis: 'M', amount: 1.5 } } } as const;

const validPp = {
  blackLevel: -7,
  gamma: 'Cine1',
  blackGamma: { range: 'Wide', level: 5 },
  knee: { mode: 'Manual', point: 75, slope: 2 },
  colorMode: 'S-Gamut3',
  saturation: 25,
  colorPhase: 1,
  colorDepth: { R: -1, G: 1, B: 5, C: 4, M: -2, Y: 2 },
  detail: { level: 0, mode: 'Manual', vhBalance: 2, bwBalance: 'Type3', limit: 3, crispening: 7, hiLightDetail: 4 },
};

const validCl = {
  look: 'SH',
  contrast: -2, highlights: -5, shadows: 4, fade: 5,
  saturation: 0, sharpness: 5, sharpnessRange: 3, clarity: 1,
};

describe('white balance', () => {
  it('accepts the documented forms', () => {
    expect(whiteBalanceSchema.safeParse(wb).success).toBe(true);
    expect(whiteBalanceSchema.safeParse({ mode: 'auto', auto: 'AWB (Priority White)' }).success).toBe(true);
  });

  it('round-trips every legacy string form in the original dataset', () => {
    const legacy = [
      '7000K, B3-M1.5', '3900K, A7', '5500K', 'AWB, A3',
      'AWB (Priority White)', 'AWB, B3-G0.25', '8200K, B4.5-G1.75', '2700K, A7-M1.25',
    ];
    for (const s of legacy) {
      const parsed = parseWhiteBalance(s);
      expect(parsed, `failed to parse ${s}`).not.toBeNull();
      expect(whiteBalanceSchema.safeParse(parsed).success, `invalid after parse: ${s}`).toBe(true);
      expect(formatWhiteBalance(parsed!)).toBe(s);
    }
  });

  it('returns null rather than guessing on malformed input', () => {
    expect(parseWhiteBalance('sunny-ish, warm')).toBeNull();
  });
});

describe('picture profile', () => {
  it('accepts a known-good profile', () => {
    expect(ppSettingsSchema.safeParse(validPp).success).toBe(true);
  });

  // Values a language model plausibly invents but the camera cannot accept.
  // Out-of-range numbers are generated from constants.ts below, per Range.
  it.each([
    ['a gamma curve that does not exist', { gamma: 'Cine9' }],
    ['a colour mode that does not exist', { colorMode: 'S-Gamut4' }],
    ['B/W Balance written with a space', { detail: { ...validPp.detail, bwBalance: 'Type 3' } }],
  ])('rejects %s', (_label, patch) => {
    expect(ppSettingsSchema.safeParse({ ...validPp, ...patch }).success).toBe(false);
  });

  // The real defect found in the legacy dataset: scl-044 shipped vhBalance "-22".
  it('rejects the out-of-range V/H Balance that shipped in scl-044', () => {
    const bad = { ...validPp, detail: { ...validPp.detail, vhBalance: -22 } };
    expect(ppSettingsSchema.safeParse(bad).success).toBe(false);
  });

  it('lists exactly the documented gamma curves', () => {
    expect(PP_GAMMA).toContain('S-Cinetone');
    expect(PP_GAMMA).not.toContain('Cine5');
  });
});

describe('creative look', () => {
  it('accepts a known-good look', () => {
    expect(clSettingsSchema.safeParse(validCl).success).toBe(true);
  });

  it('accepts every built-in Look, each once, including NT', () => {
    /* Not a count: adding a Look touches constants.ts only (rule 5), so a
       typed-in length failed the day an eleventh arrived. */
    expect(new Set(CREATIVE_LOOK_CODES).size).toBe(CREATIVE_LOOK_CODES.length);
    expect(CREATIVE_LOOK_CODES).toContain('NT');
    const { saturation: _drop, ...noSat } = validCl;
    for (const look of CREATIVE_LOOK_CODES) {
      const mono = (CL_MONOCHROME_LOOKS as readonly string[]).includes(look);
      expect(clSettingsSchema.safeParse(mono ? { ...noSat, look } : { ...validCl, look }).success, look).toBe(true);
    }
  });

  it('rejects a Look that does not exist', () => {
    expect(clSettingsSchema.safeParse({ ...validCl, look: 'XX' }).success).toBe(false);
  });

  it('rejects PP Saturation range leaking into a Creative Look', () => {
    // Legal for Picture Profile but NOT for a Creative Look.
    const leak = PP_RANGES.saturation.max;
    expect(leak).toBeGreaterThan(CL_RANGES.saturation.max);
    expect(ppSettingsSchema.safeParse({ ...validPp, saturation: leak }).success).toBe(true);
    expect(clSettingsSchema.safeParse({ ...validCl, saturation: leak }).success).toBe(false);
  });

  it('forbids Saturation on monochrome Looks', () => {
    expect(clSettingsSchema.safeParse({ ...validCl, look: 'BW' }).success).toBe(false);
    const { saturation: _drop, ...noSat } = validCl;
    expect(clSettingsSchema.safeParse({ ...noSat, look: 'BW' }).success).toBe(true);
    expect(clSettingsSchema.safeParse({ ...noSat, look: 'SE' }).success).toBe(true);
  });

  it('requires Saturation on colour Looks', () => {
    const { saturation: _drop, ...noSat } = validCl;
    expect(clSettingsSchema.safeParse({ ...noSat, look: 'VV' }).success).toBe(false);
  });

  it('formats signed and unsigned parameters the way the camera displays them', () => {
    expect(formatClValue('contrast', 2)).toBe('+2');
    expect(formatClValue('contrast', -2)).toBe('-2');
    expect(formatClValue('fade', 5)).toBe('5');
    expect(formatClValue('sharpnessRange', 3)).toBe('3');
    expect(formatClValue('clarity', 1)).toBe('1');
  });
});

describe('recipe', () => {
  const base = { slug: 'pp-001-vivid-nostalgia-film', name: 'PP-001-Vivid Nostalgia Film', whiteBalance: wb, tags: ['warm'], published: true };

  it('accepts both formats', () => {
    expect(recipeSchema.safeParse({ ...base, id: 'PP-001', format: 'pp', settings: validPp }).success).toBe(true);
    expect(
      recipeSchema.safeParse({ ...base, id: 'CL-001', slug: 'x', name: 'y', format: 'cl', settings: validCl }).success,
    ).toBe(true);
    /* A row the content migration has not reached yet still reads. */
    expect(recipeSchema.safeParse({ ...base, id: 'SCL-PP-001', format: 'pp', settings: validPp }).success).toBe(true);
  });

  it('accepts the code shape the ids are moving to, in both formats', () => {
    expect(recipeSchema.safeParse({ ...base, id: 'PP-001', format: 'pp', settings: validPp }).success).toBe(true);
    expect(
      recipeSchema.safeParse({ ...base, id: 'CL-045', slug: 'x', name: 'y', format: 'cl', settings: validCl }).success,
    ).toBe(true);
  });

  it('rejects an id whose segment disagrees with the format', () => {
    expect(recipeSchema.safeParse({ ...base, id: 'SCL-CL-001', format: 'pp', settings: validPp }).success).toBe(false);
    expect(recipeSchema.safeParse({ ...base, id: 'CL-001', format: 'pp', settings: validPp }).success).toBe(false);
    expect(
      recipeSchema.safeParse({ ...base, id: 'PP-001', slug: 'x', name: 'y', format: 'cl', settings: validCl }).success,
    ).toBe(false);
  });

  it('keeps RECIPE_ID_RE to the stored shape the CHECK enforces', () => {
    expect(RECIPE_ID_RE.test('SCL-PP-001')).toBe(true);
    expect(RECIPE_ID_RE.test('PP-001')).toBe(false);
    expect(RECIPE_ID_TRANSITION_RE.test('PP-001')).toBe(true);
    expect(RECIPE_ID_TRANSITION_RE.test('SCL-PP-001')).toBe(true);
  });

  it('rejects legacy ids that predate the two-format split', () => {
    for (const id of ['scl-001', 'SCL-44', 'PROCOLOR-001', 'pp-001', 'PP-1000', 'XSCL-PP-001', 'SCL-PP-01', 'SCL--PP-001']) {
      expect(recipeSchema.safeParse({ ...base, id, format: 'pp', settings: validPp }).success).toBe(false);
    }
  });

  it('rejects a recipe carrying both formats of settings', () => {
    // PP and Creative Look are mutually exclusive on the camera.
    const both = { ...base, id: 'PP-001', format: 'pp', settings: { ...validPp, ...validCl } };
    expect(recipeSchema.safeParse(both).success).toBe(false);
  });
});

/**
 * Every Range in constants.ts, run through the real schema at its edges.
 *
 * The bounds are read, never typed (rules 1 and 5), so widening a range moves
 * every case with it. Per range: both ends accepted, one step past either end
 * refused, one step in accepted, and half a step in refused — the step refine
 * in `ranged()` was otherwise never shown to reject an off-grid value, so 5550K
 * or a 75.25% knee could have slipped through with this file green.
 *
 * Keyed by the range's own name, so a new entry in PP_RANGES or CL_RANGES is a
 * type error here until it has a probe.
 */
type Probe = (v: number) => boolean;
const pp = (patch: (v: number) => object): Probe => (v) =>
  ppSettingsSchema.safeParse({ ...validPp, ...patch(v) }).success;
const cl = (key: keyof typeof CL_RANGES): Probe => (v) =>
  clSettingsSchema.safeParse({ ...validCl, [key]: v }).success;
const detail = (key: keyof typeof validPp.detail) => pp((v) => ({ detail: { ...validPp.detail, [key]: v } }));

const PP_PROBES: Record<keyof typeof PP_RANGES, Probe> = {
  blackLevel: pp((v) => ({ blackLevel: v })),
  blackGammaLevel: pp((v) => ({ blackGamma: { ...validPp.blackGamma, level: v } })),
  kneeAutoMaxPoint: pp((v) => ({ knee: { mode: 'Auto', maxPoint: v } })),
  kneeManualPoint: pp((v) => ({ knee: { ...validPp.knee, point: v } })),
  kneeManualSlope: pp((v) => ({ knee: { ...validPp.knee, slope: v } })),
  saturation: pp((v) => ({ saturation: v })),
  colorPhase: pp((v) => ({ colorPhase: v })),
  colorDepth: pp((v) => ({ colorDepth: { ...validPp.colorDepth, R: v } })),
  detailLevel: detail('level'),
  detailVhBalance: detail('vhBalance'),
  detailLimit: detail('limit'),
  detailCrispening: detail('crispening'),
  detailHiLightDetail: detail('hiLightDetail'),
};

const CL_PROBES: Record<keyof typeof CL_RANGES, Probe> = Object.fromEntries(
  Object.keys(CL_RANGES).map((k) => [k, cl(k as keyof typeof CL_RANGES)]),
) as Record<keyof typeof CL_RANGES, Probe>;

const RANGES: [string, Range, Probe][] = [
  ...Object.entries(PP_RANGES).map(([k, r]): [string, Range, Probe] => [
    `PP ${k}`, r, PP_PROBES[k as keyof typeof PP_RANGES],
  ]),
  ...Object.entries(CL_RANGES).map(([k, r]): [string, Range, Probe] => [
    `CL ${k}`, r, CL_PROBES[k as keyof typeof CL_RANGES],
  ]),
  ['WB Kelvin', WB_KELVIN, (v) => whiteBalanceSchema.safeParse({ mode: 'kelvin', kelvin: v }).success],
  [
    'WB shift',
    WB_SHIFT_AXIS,
    (v) =>
      whiteBalanceSchema.safeParse({ mode: 'kelvin', kelvin: WB_KELVIN.min, shift: { ab: { axis: 'A', amount: v } } })
        .success,
  ],
];

describe.each(RANGES)('%s', (_name, range, accepts) => {
  it(`accepts both ends and the first step in`, () => {
    expect(accepts(range.min), `${range.min}`).toBe(true);
    expect(accepts(range.max), `${range.max}`).toBe(true);
    expect(accepts(range.min + range.step), `${range.min + range.step}`).toBe(true);
  });

  it(`refuses one step past either end`, () => {
    expect(accepts(range.min - range.step), `${range.min - range.step}`).toBe(false);
    expect(accepts(range.max + range.step), `${range.max + range.step}`).toBe(false);
  });

  it(`refuses a value between two steps`, () => {
    expect(accepts(range.min + range.step / 2), `${range.min + range.step / 2}`).toBe(false);
  });
});

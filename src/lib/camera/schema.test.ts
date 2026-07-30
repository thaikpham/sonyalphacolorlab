import { describe, expect, it } from 'vitest';
import { clSettingsSchema, ppSettingsSchema, recipeSchema, whiteBalanceSchema } from './schema';
import { formatClValue, formatWhiteBalance, parseWhiteBalance } from './format';
import { CREATIVE_LOOK_CODES, PP_GAMMA } from './constants';

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

  it('rejects Kelvin outside the camera range', () => {
    expect(whiteBalanceSchema.safeParse({ mode: 'kelvin', kelvin: 12000 }).success).toBe(false);
    expect(whiteBalanceSchema.safeParse({ mode: 'kelvin', kelvin: 1000 }).success).toBe(false);
  });

  it('rejects a shift beyond the 7-step axis', () => {
    const bad = { mode: 'kelvin', kelvin: 5500, shift: { ab: { axis: 'A', amount: 9 } } };
    expect(whiteBalanceSchema.safeParse(bad).success).toBe(false);
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
  it.each([
    ['a gamma curve that does not exist', { gamma: 'Cine9' }],
    ['a colour mode that does not exist', { colorMode: 'S-Gamut4' }],
    ['Black Level past +15', { blackLevel: 30 }],
    ['PP Saturation past +32', { saturation: 50 }],
    ['Color Phase past +7', { colorPhase: 12 }],
    ['Knee point below 75%', { knee: { mode: 'Manual', point: 50, slope: 0 } }],
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

  it('has all ten built-in Looks including NT', () => {
    expect(CREATIVE_LOOK_CODES).toHaveLength(10);
    expect(CREATIVE_LOOK_CODES).toContain('NT');
  });

  // The unsigned parameters are the most common source of bad data.
  it.each([
    ['negative Fade', { fade: -3 }],
    ['negative Sharpness', { sharpness: -5 }],
    ['negative Clarity', { clarity: -1 }],
    ['Sharpness Range of 0', { sharpnessRange: 0 }],
    ['Sharpness Range past 5', { sharpnessRange: 7 }],
    ['Contrast past +9', { contrast: 20 }],
    ['a Look that does not exist', { look: 'XX' }],
  ])('rejects %s', (_label, patch) => {
    expect(clSettingsSchema.safeParse({ ...validCl, ...patch }).success).toBe(false);
  });

  it('rejects PP Saturation range leaking into a Creative Look', () => {
    // -32..+32 is legal for Picture Profile but NOT for a Creative Look.
    expect(clSettingsSchema.safeParse({ ...validCl, saturation: 25 }).success).toBe(false);
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
  const base = { slug: 'mojave-sun', name: 'SCL-PP-001: Mojave Sun', whiteBalance: wb, tags: ['warm'], published: true };

  it('accepts both formats', () => {
    expect(recipeSchema.safeParse({ ...base, id: 'SCL-PP-001', format: 'pp', settings: validPp }).success).toBe(true);
    expect(
      recipeSchema.safeParse({ ...base, id: 'SCL-CL-001', slug: 'x', name: 'y', format: 'cl', settings: validCl }).success,
    ).toBe(true);
  });

  it('rejects an id whose segment disagrees with the format', () => {
    expect(recipeSchema.safeParse({ ...base, id: 'SCL-CL-001', format: 'pp', settings: validPp }).success).toBe(false);
  });

  it('rejects legacy ids that predate the two-format split', () => {
    for (const id of ['scl-001', 'SCL-44', 'PROCOLOR-001']) {
      expect(recipeSchema.safeParse({ ...base, id, format: 'pp', settings: validPp }).success).toBe(false);
    }
  });

  it('rejects a recipe carrying both formats of settings', () => {
    // PP and Creative Look are mutually exclusive on the camera.
    const both = { ...base, id: 'SCL-PP-001', format: 'pp', settings: { ...validPp, ...validCl } };
    expect(recipeSchema.safeParse(both).success).toBe(false);
  });
});

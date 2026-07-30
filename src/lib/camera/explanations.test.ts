import { describe, expect, it } from 'vitest';
import {
  CL_EXPLANATIONS,
  COLOR_DEPTH_EXPLANATIONS,
  PP_DETAIL_EXPLANATIONS,
  PP_EXPLANATIONS,
  explain,
} from './explanations';
import { CL_PARAM_ORDER, PP_COLOR_DEPTH_CHANNELS } from './constants';
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
    // The single most confusable pair in the whole app.
    expect(PP_EXPLANATIONS.saturation.en).toContain('-32 to +32');
    expect(CL_EXPLANATIONS.saturation.en).toContain('-9 to +9');
    expect(PP_EXPLANATIONS.saturation.vi).toContain('-32');
    expect(CL_EXPLANATIONS.saturation.vi).toContain('-9');
  });

  it('flags the unsigned Creative Look parameters', () => {
    for (const p of ['fade', 'sharpness', 'clarity'] as const) {
      expect(CL_EXPLANATIONS[p].en.toLowerCase(), p).toContain('never negative');
    }
    expect(CL_EXPLANATIONS.sharpnessRange.en).toContain('never signed');
  });

  it('returns undefined for an unknown key instead of throwing', () => {
    expect(explain(PP_EXPLANATIONS, 'nonexistent', 'en')).toBeUndefined();
  });
});

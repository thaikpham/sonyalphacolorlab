import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { importSonyAsia, parseCsv, REJECTED, SCRAPE_CORRECTIONS } from './import';
import {
  CL_MONOCHROME_LOOKS,
  CL_RANGES,
  CREATIVE_LOOK_CODES,
  WB_AUTO_MODES,
  WB_PRESETS,
} from '../camera/constants';
import { recipeSchema } from '../camera/schema';

/**
 * The scrape is a third-party HTML export of a marketing page: inconsistent
 * spelling, repeated rows, and settings the camera cannot take. These tests pin
 * the two behaviours that matter — every recipe that survives is a legal camera
 * state, and every row that does not survive is *reported* rather than quietly
 * dropped or filled in with a plausible guess.
 */
const csv = readFileSync('data/sony-asia-creative-looks.csv', 'utf8');
const result = importSonyAsia(csv);

describe('Sony Asia CSV', () => {
  it('reads every scraped row', () => {
    expect(parseCsv(csv)).toHaveLength(53);
  });

  it('produces recipes, and accounts for every row it did not', () => {
    // rows = recipes + merged duplicates + skips. Nothing vanishes silently.
    expect(result.recipes.length + result.duplicates + result.skipped.length).toBe(53);
    expect(result.recipes.length).toBeGreaterThan(30);
  });

  it('gives every skipped row a reason', () => {
    for (const s of result.skipped) {
      expect(s.why.length, s.data).toBeGreaterThan(20);
    }
  });
});

describe('imported recipes', () => {
  it('every recipe re-validates against recipeSchema', () => {
    for (const r of result.recipes) {
      const { images: _i, credit: _c, ...recipe } = r;
      const parsed = recipeSchema.safeParse(recipe);
      expect(parsed.success, `${r.id}: ${parsed.error?.message}`).toBe(true);
    }
  });

  it('is entirely Creative Look, with ids and slugs to match', () => {
    const slugs = new Set<string>();
    const ids = new Set<string>();
    for (const r of result.recipes) {
      expect(r.format).toBe('cl');
      expect(r.id).toMatch(/^SCL-CL-\d{3}$/);
      expect(slugs.has(r.slug), `duplicate slug ${r.slug}`).toBe(false);
      expect(ids.has(r.id), `duplicate id ${r.id}`).toBe(false);
      slugs.add(r.slug);
      ids.add(r.id);
    }
  });

  it('only uses the ten built-in Looks', () => {
    for (const r of result.recipes) {
      expect(CREATIVE_LOOK_CODES).toContain((r.settings as { look: string }).look);
    }
  });

  it('holds every parameter inside its own range', () => {
    for (const r of result.recipes) {
      const s = r.settings as unknown as Record<string, number>;
      for (const [param, range] of Object.entries(CL_RANGES)) {
        if (s[param] === undefined) continue;
        expect(s[param], `${r.id}.${param}`).toBeGreaterThanOrEqual(range.min);
        expect(s[param], `${r.id}.${param}`).toBeLessThanOrEqual(range.max);
      }
    }
  });

  it('omits Saturation on monochrome Looks and sets it everywhere else', () => {
    for (const r of result.recipes) {
      const s = r.settings as { look: string; saturation?: number };
      const mono = (CL_MONOCHROME_LOOKS as readonly string[]).includes(s.look);
      expect(s.saturation === undefined, `${r.id} (${s.look})`).toBe(mono);
    }
  });

  it('carries a photographer credit and a source URL on every recipe', () => {
    for (const r of result.recipes) {
      expect(r.credit.photographer.length, r.id).toBeGreaterThan(0);
      expect(r.credit.source).toContain('sony-asia.com');
    }
  });

  it('writes an English description for every recipe', () => {
    for (const r of result.recipes) {
      expect(result.descriptions[r.id]?.length ?? 0, r.id).toBeGreaterThan(30);
    }
  });
});

describe('White Balance from the scrape', () => {
  const wbOf = (slug: string) => result.recipes.find((r) => r.slug === slug)?.whiteBalance;

  it('reads a light-source preset with a shift', () => {
    // "WB Cloudy A1.5, M0.5" — the pairing the preset mode was added for.
    expect(wbOf('fl-arantha-sirimanne')).toEqual({
      mode: 'preset',
      preset: 'Cloudy',
      shift: { ab: { axis: 'A', amount: 1.5 }, gm: { axis: 'M', amount: 0.5 } },
    });
  });

  it('reads a bare preset', () => {
    expect(wbOf('vv-khong')).toEqual({ mode: 'preset', preset: 'Daylight' });
  });

  it('reads Kelvin with a space-separated shift', () => {
    // "WB Colour Temp 6500K B2.5 M5.0" — the page separates with spaces, the
    // legacy parser expects commas.
    expect(wbOf('in-sony-asia')).toEqual({
      mode: 'kelvin',
      kelvin: 6500,
      shift: { ab: { axis: 'B', amount: 2.5 }, gm: { axis: 'M', amount: 5 } },
    });
  });

  it('reads AWB with a shift', () => {
    expect(wbOf('in-jonpoon-jpg')).toEqual({
      mode: 'auto',
      auto: 'AWB',
      shift: { ab: { axis: 'A', amount: 1 }, gm: { axis: 'G', amount: 1 } },
    });
  });

  it('survives a newline inside the WB clause', () => {
    // One row is scraped as "WB Colour\n\nTemp 5000K A3 G1". Splitting the
    // settings on the blank line truncated it and lost the setting entirely.
    expect(wbOf('fl-hea-kimhong')).toEqual({
      mode: 'kelvin',
      kelvin: 5000,
      shift: { ab: { axis: 'A', amount: 3 }, gm: { axis: 'G', amount: 1 } },
    });
  });
});

/* Synthetic rows, so a parsing rule can be pinned without waiting for the
   scrape to contain an instance of it. */
const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
const csvOf = (...data: string[]) =>
  ['name,data,data2,data3,data4,image,image11', ...data.map((d) => ['Test', d, '', 'Testland', '', '', ''].map(q).join(','))].join('\n');
const ST = 'ST (Standard) | Contrast 0, Highlights 0, Shadows 0, Fade 0, Saturation 0, Sharpness 4, Sharpness Range 3, Clarity 1';

describe('parseCsv', () => {
  it('strips a BOM, unescapes doubled quotes and keeps newlines inside quotes', () => {
    expect(parseCsv('﻿a,b\r\n"x ""q""\ny",2\r\n')).toEqual([{ a: 'x "q"\ny', b: '2' }]);
  });

  it('drops CR outside quotes but keeps it inside them', () => {
    expect(parseCsv('a,b\r\n"l1\r\nl2",2\r\n')).toEqual([{ a: 'l1\r\nl2', b: '2' }]);
  });

  it('adds no row for a trailing newline, and none for a blank or one-column line', () => {
    expect(parseCsv('a,b\n1,2\n\nstray\n')).toEqual([{ a: '1', b: '2' }]);
  });

  it('refuses an unterminated quote instead of swallowing the rest of the file', () => {
    expect(() => parseCsv('a,b\n"open,1\n2,3\n')).toThrow(/unterminated/i);
  });
});

describe('settings tokens', () => {
  it('reports a parameter written with no number, rather than storing 0', () => {
    // "Contrast 0 and no Contrast token are different claims" — and so is a
    // Contrast token with no number. Number('') is 0.
    const { recipes, skipped } = importSonyAsia(csvOf(`${ST.replace('Contrast 0', 'Contrast')}, WB AWB`));
    expect(recipes).toHaveLength(0);
    expect(skipped[0]?.why).toContain('contrast');
    const fade = importSonyAsia(csvOf(`${ST.replace('Fade 0', 'Fade ')}, WB AWB`));
    expect(fade.skipped[0]?.why).toContain('fade');
  });

  it('splits tokens on a comma with no space after it', () => {
    // Why SCRAPE_CORRECTIONS needs no "Fade 0,Saturation" entry.
    const { recipes } = importSonyAsia(csvOf(`${ST.replace('Fade 0, Saturation 0', 'Fade 2,Saturation 3')}, WB AWB`));
    expect(recipes[0]?.settings).toMatchObject({ fade: 2, saturation: 3 });
    expect(SCRAPE_CORRECTIONS.some((c) => c.from.includes('Fade 0,Saturation'))).toBe(false);
  });
});

describe('White Balance names from constants.ts', () => {
  it('reads every light-source preset and Auto mode by its own name', () => {
    for (const preset of WB_PRESETS) {
      const { recipes } = importSonyAsia(csvOf(`${ST}, WB ${preset}`));
      expect(recipes[0]?.whiteBalance, preset).toEqual({ mode: 'preset', preset });
    }
    for (const auto of WB_AUTO_MODES) {
      const { recipes } = importSonyAsia(csvOf(`${ST}, WB ${auto}`));
      expect(recipes[0]?.whiteBalance, auto).toEqual({ mode: 'auto', auto });
    }
  });
});

describe('corrections and refusals', () => {
  it('fixes the SH Look code without corrupting the correct ones', () => {
    // An unanchored 'H (Soft Highkey)' -> 'SH (…)' rewrite also matches inside
    // a correct 'SH (Soft Highkey)' and produces 'SSH'.
    const looks = result.recipes.map((r) => (r.settings as { look: string }).look);
    expect(looks).toContain('SH');
    expect(looks.filter((l) => l === 'SH').length).toBeGreaterThan(1);
  });

  it('reads VV2, whose code contains a digit', () => {
    expect(result.recipes.some((r) => (r.settings as { look: string }).look === 'VV2')).toBe(true);
  });

  it('refuses a Kelvin range rather than picking an end of it', () => {
    expect(result.skipped.some((s) => s.data.includes('5200K-5600K'))).toBe(true);
    for (const r of result.recipes) {
      expect(JSON.stringify(r.whiteBalance)).not.toContain('-');
    }
  });

  it('refuses "Default Settings" rather than inventing per-Look defaults', () => {
    // Sony's Creative Look page documents what each Look is but publishes no
    // default value for any parameter, and Sharpness Range starts at 1, so
    // "all zeros" is not even a legal row.
    expect(CL_RANGES.sharpnessRange.min).toBe(1);
    expect(result.skipped.filter((s) => /Default Settings/i.test(s.data)).length).toBeGreaterThan(0);
  });

  it('refuses a row with no stated White Balance', () => {
    const noWb = result.skipped.filter((s) => s.why.includes('no White Balance'));
    expect(noWb.length).toBeGreaterThan(0);
  });

  it('documents why every correction and refusal exists', () => {
    for (const c of SCRAPE_CORRECTIONS) expect(c.why.length).toBeGreaterThan(20);
    for (const r of REJECTED) expect(r.why.length).toBeGreaterThan(20);
  });
});

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import recipesSeed from '../../../data/recipes.seed.json';
import type { Recipe } from '../camera/schema';
import { removeAccents } from '../search/fuzzy-search';
import { TAXONOMY_MANIFEST, taxonomyFor } from './taxonomy-assign';
import {
  MAX_SITUATIONS,
  SITUATION_SYNONYMS,
  SITUATIONS,
  STYLE_SYNONYMS,
  STYLES,
  TONE_SYNONYMS,
  TONES,
  deriveTaxonomy,
  isMonochrome,
  parseSituation,
  parseStyle,
  parseTone,
  styleFromSettings,
  situationsFromSettings,
  taxonomyTerms,
  toneFromWhiteBalance,
} from './taxonomy';

const seed = recipesSeed as unknown as (Recipe & { legacyId: string | null })[];
const messages = Object.fromEntries(
  (['en', 'vi'] as const).map((l) => [
    l,
    JSON.parse(readFileSync(`messages/${l}.json`, 'utf8')) as {
      browse: { situations: Record<string, string>; styles: Record<string, string>; tones: Record<string, string> };
    },
  ]),
);

const fold = (s: string) => removeAccents(s).toLowerCase();

const pp = (over: Partial<Extract<Recipe, { format: 'pp' }>['settings']> = {}, wb: Recipe['whiteBalance'] = { mode: 'kelvin', kelvin: 5500 }): Recipe => ({
  id: 'SCL-PP-999',
  slug: 'x',
  name: 'SCL-PP-999: X',
  format: 'pp',
  whiteBalance: wb,
  tags: [],
  published: true,
  settings: {
    blackLevel: 0,
    gamma: 'Still',
    blackGamma: { range: 'Middle', level: 0 },
    knee: { mode: 'Auto' },
    colorMode: 'Still',
    saturation: 0,
    colorPhase: 0,
    colorDepth: { R: 0, G: 0, B: 0, C: 0, M: 0, Y: 0 },
    detail: { level: 0, mode: 'Manual', vhBalance: 0, bwBalance: 'Type3', limit: 0, crispening: 0, hiLightDetail: 0 },
    ...over,
  },
});

const cl = (look: Extract<Recipe, { format: 'cl' }>['settings']['look'], over: Partial<Extract<Recipe, { format: 'cl' }>['settings']> = {}): Recipe => ({
  id: 'SCL-CL-999',
  slug: 'x',
  name: 'SCL-CL-999: X',
  format: 'cl',
  whiteBalance: { mode: 'auto', auto: 'AWB' },
  tags: [],
  published: true,
  settings: {
    look,
    contrast: 0,
    highlights: 0,
    shadows: 0,
    fade: 0,
    ...(look === 'BW' || look === 'SE' ? {} : { saturation: 0 }),
    sharpness: 0,
    sharpnessRange: 3,
    clarity: 0,
    ...over,
  },
});

describe('the ids', () => {
  it('are unique, URL-safe and parse back to themselves', () => {
    for (const list of [SITUATIONS, STYLES, TONES]) {
      expect(new Set(list).size).toBe(list.length);
      for (const id of list) expect(id).toMatch(/^[a-z]+$/);
    }
    for (const id of SITUATIONS) expect(parseSituation(id)).toBe(id);
    for (const id of STYLES) expect(parseStyle(id)).toBe(id);
    for (const id of TONES) expect(parseTone(id)).toBe(id);
    expect(parseSituation('Portrait')).toBeNull();
    expect(parseSituation(['portrait'])).toBeNull();
    expect(parseStyle('')).toBeNull();
    expect(parseTone(undefined)).toBeNull();
  });

  it.each(['en', 'vi'] as const)('every id has a %s label', (locale) => {
    const m = messages[locale].browse;
    for (const id of SITUATIONS) expect(m.situations[id], `situations.${id}`).toBeTruthy();
    for (const id of STYLES) expect(m.styles[id], `styles.${id}`).toBeTruthy();
    for (const id of TONES) expect(m.tones[id], `tones.${id}`).toBeTruthy();
    /* And no label for an id that no longer exists. */
    expect(Object.keys(m.situations).sort()).toEqual([...SITUATIONS].sort());
    expect(Object.keys(m.styles).sort()).toEqual([...STYLES].sort());
    expect(Object.keys(m.tones).sort()).toEqual([...TONES].sort());
  });

  it('can be found by typing its label in either language', () => {
    /* The synonyms are the search vocabulary. A label that is not in them is
       a word on screen that search does not know. */
    for (const locale of ['en', 'vi'] as const) {
      const m = messages[locale].browse;
      for (const id of SITUATIONS) expect(SITUATION_SYNONYMS[id].map(fold), `${locale} ${id}`).toContain(fold(m.situations[id]));
      for (const id of STYLES) expect(STYLE_SYNONYMS[id].map(fold), `${locale} ${id}`).toContain(fold(m.styles[id]));
      for (const id of TONES) expect(TONE_SYNONYMS[id].map(fold), `${locale} ${id}`).toContain(fold(m.tones[id]));
    }
  });
});

describe('monochrome is read off the settings', () => {
  it('is the Black & White colour mode, or a BW/SE Look, and nothing else', () => {
    expect(isMonochrome(pp({ colorMode: 'Black & White' }))).toBe(true);
    expect(isMonochrome(pp({ colorMode: 'Still' }))).toBe(false);
    expect(isMonochrome(cl('BW'))).toBe(true);
    expect(isMonochrome(cl('SE'))).toBe(true);
    expect(isMonochrome(cl('FL'))).toBe(false);
  });

  it('always wins, in both directions', () => {
    for (const r of seed) {
      const t = taxonomyFor(r);
      expect(t.tone === 'mono', `${r.id} tone=${t.tone} mono=${isMonochrome(r)}`).toBe(isMonochrome(r));
    }
  });

  it('is never contradicted by the manifest', () => {
    for (const [id, entry] of Object.entries(TAXONOMY_MANIFEST)) {
      const r = seed.find((x) => x.id === id);
      if (!r || !entry.tone) continue;
      expect(entry.tone === 'mono', `${id}: manifest says ${entry.tone}`).toBe(isMonochrome(r));
    }
  });
});

describe('tone from the white balance', () => {
  it('names a bare Kelvin warm from 5900K and cool from 5150K, neutral between', () => {
    /* 12 mired either side of 5500K: 1e6/5500 − 1e6/5900 ≈ +12.3, and
       1e6/5500 − 1e6/5150 ≈ −12.4. 5200K is −10.5, inside the band. */
    expect(toneFromWhiteBalance({ mode: 'kelvin', kelvin: 5900 })).toBe('warm');
    expect(toneFromWhiteBalance({ mode: 'kelvin', kelvin: 6500 })).toBe('warm');
    expect(toneFromWhiteBalance({ mode: 'kelvin', kelvin: 5600 })).toBe('neutral');
    expect(toneFromWhiteBalance({ mode: 'kelvin', kelvin: 5500 })).toBe('neutral');
    expect(toneFromWhiteBalance({ mode: 'kelvin', kelvin: 5200 })).toBe('neutral');
    expect(toneFromWhiteBalance({ mode: 'kelvin', kelvin: 5150 })).toBe('cool');
  });

  it('widens the band to one shift step while an amber–blue shift is set', () => {
    /* Sài Gòn Café's own rule: never warm or cool inside one step of neutral. */
    expect(toneFromWhiteBalance({ mode: 'kelvin', kelvin: 5500, shift: { ab: { axis: 'A', amount: 0.5 } } })).toBe('neutral');
    expect(toneFromWhiteBalance({ mode: 'kelvin', kelvin: 5500, shift: { ab: { axis: 'A', amount: 1 } } })).toBe('warm');
    expect(toneFromWhiteBalance({ mode: 'kelvin', kelvin: 5500, shift: { ab: { axis: 'B', amount: 1 } } })).toBe('cool');
    expect(toneFromWhiteBalance({ mode: 'auto', auto: 'AWB', shift: { ab: { axis: 'A', amount: 1.5 } } })).toBe('warm');
    expect(toneFromWhiteBalance({ mode: 'preset', preset: 'Cloudy' })).toBe('neutral');
  });
});

describe('style and situations from the settings', () => {
  it('places each Look', () => {
    expect(styleFromSettings(cl('FL'))).toBe('film');
    expect(styleFromSettings(cl('IN'))).toBe('film');
    expect(styleFromSettings(cl('SE'))).toBe('film');
    expect(styleFromSettings(cl('BW'))).toBe('film');
    expect(styleFromSettings(cl('VV'))).toBe('vivid');
    expect(styleFromSettings(cl('VV2'))).toBe('vivid');
    for (const look of ['ST', 'PT', 'NT', 'SH'] as const) expect(styleFromSettings(cl(look))).toBe('natural');
  });

  it('reads a Picture Profile as range, vivid or natural', () => {
    expect(styleFromSettings(pp({ gamma: 'S-Log3', colorMode: 'S-Gamut3' }))).toBe('range');
    expect(styleFromSettings(pp({ gamma: 'HLG2', colorMode: 'BT.2020' }))).toBe('range');
    expect(styleFromSettings(pp({ saturation: 16 }))).toBe('vivid');
    expect(styleFromSettings(pp({ saturation: 15 }))).toBe('natural');
    expect(styleFromSettings(pp({ saturation: -10 }))).toBe('natural');
  });

  it('places a Film Look by its Fade, Clarity and Contrast', () => {
    expect(situationsFromSettings(cl('FL', { fade: 3 }))).toEqual(['lifestyle', 'daily']);
    expect(situationsFromSettings(cl('FL', { clarity: 4 }))).toEqual(['street', 'daily']);
    expect(situationsFromSettings(cl('FL', { contrast: 2 }))).toEqual(['street', 'daily']);
    expect(situationsFromSettings(cl('FL'))).toEqual(['daily', 'street']);
    expect(situationsFromSettings(cl('SH'))).toEqual(['portrait', 'lifestyle', 'fashion']);
    expect(situationsFromSettings(cl('PT'))).toEqual(['portrait']);
    expect(situationsFromSettings(cl('BW'))).toEqual(['street', 'daily']);
  });

  it('places no Picture Profile on its own', () => {
    expect(situationsFromSettings(pp())).toEqual([]);
    expect(deriveTaxonomy(pp({ colorMode: 'Black & White' }))).toEqual({ situations: [], style: 'natural', tone: 'mono' });
  });
});

describe('the manifest', () => {
  it('names only published recipe ids, and every Picture Profile in the seed', () => {
    const ids = new Set(seed.map((r) => r.id));
    for (const id of Object.keys(TAXONOMY_MANIFEST)) expect(ids.has(id), `${id} is not in the seed`).toBe(true);
    for (const r of seed) {
      if (r.format === 'pp') expect(TAXONOMY_MANIFEST[r.id], `${r.id} has no manifest entry`).toBeDefined();
    }
  });

  it('places every recipe in at most three distinct, known situations with a known style and tone', () => {
    for (const [id, entry] of Object.entries(TAXONOMY_MANIFEST)) {
      const s = entry.situations ?? [];
      expect(s.length, id).toBeLessThanOrEqual(MAX_SITUATIONS);
      expect(new Set(s).size, `${id} repeats a situation`).toBe(s.length);
      for (const x of s) expect(parseSituation(x), `${id}: ${x}`).not.toBeNull();
      if (entry.style !== undefined) expect(parseStyle(entry.style), `${id}: ${entry.style}`).not.toBeNull();
      if (entry.tone !== undefined) expect(parseTone(entry.tone), `${id}: ${entry.tone}`).not.toBeNull();
    }
  });

  it('overrides the derivation where it speaks, and only there', () => {
    const edited = taxonomyFor(seed.find((r) => r.id === 'SCL-PP-001')!);
    expect(edited).toEqual({ situations: ['travel', 'lifestyle'], style: 'film', tone: 'warm' });
    /* 002 leaves tone to the white balance: 3700K with A7 is warm. */
    expect(taxonomyFor(seed.find((r) => r.id === 'SCL-PP-002')!).tone).toBe('warm');
    /* A Creative Look has no entry and browses by its Look. */
    const look = taxonomyFor(seed.find((r) => r.id === 'SCL-CL-003')!);
    expect(look).toEqual({ situations: ['travel', 'landscape'], style: 'vivid', tone: 'neutral' });
  });
});

describe('the search vocabulary', () => {
  it('lists every synonym of what a recipe carries, in both languages', () => {
    const terms = taxonomyTerms({ situations: ['portrait'], style: 'film', tone: 'mono' });
    expect(terms).toContain('chân dung');
    expect(terms).toContain('portrait');
    expect(terms).toContain('phim');
    expect(terms).toContain('đen trắng');
    expect(terms).not.toContain('du lịch');
  });
});

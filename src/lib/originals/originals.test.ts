import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PP_RANGES, PP_COLOR_DEPTH_CHANNELS } from '../camera/constants';
import { recipeSchema, type PpSettings, type Recipe } from '../camera/schema';
import { TAXONOMY_MANIFEST, taxonomyFor } from '../recipes/taxonomy-assign';
import { parseSituation } from '../recipes/taxonomy';
import { ORIGINAL_CL } from './cl';
import { ORIGINAL_PP, type OriginalRecipe } from './pp';

/**
 * The cook rules for ColorLab's own recipes — what Sony's Help Guide for
 * Creators documents about each parameter, held as a test so a later tuning
 * pass cannot drift off it without saying so.
 */

const ALL: readonly OriginalRecipe[] = [...ORIGINAL_PP, ...ORIGINAL_CL];
const vi = JSON.parse(readFileSync('data/translations.vi.json', 'utf8')) as Record<string, string>;

const ppOf = (o: OriginalRecipe): PpSettings | null =>
  o.recipe.format === 'pp' ? o.recipe.settings : null;

/** The Gamma ↔ Color Mode pairs Sony documents (TP0000909106–112). */
function documentedPair(gamma: PpSettings['gamma'], mode: PpSettings['colorMode']): boolean {
  if (mode === 'Black & White') return true;
  if (gamma === 'Movie') return mode === 'Movie';
  if (gamma === 'Still') return mode === 'Still';
  if (gamma === 'S-Cinetone') return mode === 'S-Cinetone';
  if (gamma === 'Cine1' || gamma === 'Cine2') return mode === 'Cinema';
  if (gamma === 'ITU709') return mode === 'Pro' || mode === '709tone' || mode === 'ITU709 Matrix';
  if (gamma.startsWith('HLG')) return mode === 'BT.2020' || mode === '709';
  if (gamma === 'S-Log3') return mode === 'S-Gamut3' || mode === 'S-Gamut3.Cine';
  if (gamma === 'S-Log2') return mode === 'S-Gamut';
  return false;
}

/** Knee Auto works on Movie and ITU709; on S-Log and HLG it is documented off. */
const kneeAutoAllowed = (gamma: PpSettings['gamma']) =>
  gamma === 'Movie' || gamma === 'ITU709' || gamma.startsWith('S-Log') || gamma.startsWith('HLG');

const sequence = (list: readonly OriginalRecipe[]) => list.map((o) => Number(o.recipe.id.slice(-3)));
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

describe('the originals', () => {
  it('parse with recipeSchema, each in its own format', () => {
    for (const o of ORIGINAL_PP) {
      expect(recipeSchema.safeParse(o.recipe).success, o.recipe.id).toBe(true);
      expect(o.recipe.format, o.recipe.id).toBe('pp');
    }
    for (const o of ORIGINAL_CL) {
      expect(recipeSchema.safeParse(o.recipe).success, o.recipe.id).toBe(true);
      expect(o.recipe.format, o.recipe.id).toBe('cl');
    }
  });

  it('are all unpublished until shot on a camera', () => {
    for (const o of ALL) expect(o.recipe.published, o.recipe.id).toBe(false);
  });

  it('are numbered without gaps: PP 048–082, CL 038–045', () => {
    expect(sequence(ORIGINAL_PP)).toEqual(range(48, 82));
    expect(sequence(ORIGINAL_CL)).toEqual(range(38, 45));
    const ids = ALL.map((o) => o.recipe.id);
    expect(new Set(ids).size).toBe(ids.length);
    const slugs = ALL.map((o) => o.recipe.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('carry three to five tags', () => {
    for (const o of ALL) {
      expect(o.recipe.tags.length, o.recipe.id).toBeGreaterThanOrEqual(3);
      expect(o.recipe.tags.length, o.recipe.id).toBeLessThanOrEqual(5);
    }
  });

  it('use Knee Auto only where Sony documents what it does', () => {
    for (const o of ORIGINAL_PP) {
      const s = ppOf(o)!;
      if (s.knee.mode === 'Auto') expect(kneeAutoAllowed(s.gamma), `${o.recipe.id} ${s.gamma}`).toBe(true);
      else expect(s.knee.slope, `${o.recipe.id}: slope +5 is Knee off`).not.toBe(PP_RANGES.kneeManualSlope.max);
    }
  });

  it('keep Color Phase small, and at zero on any portrait recipe', () => {
    /* Phase rotates every hue, skin included; Sony reserves it for matching. */
    for (const o of ORIGINAL_PP) {
      const s = ppOf(o)!;
      expect(Math.abs(s.colorPhase), o.recipe.id).toBeLessThanOrEqual(2);
      if (taxonomyFor(o.recipe).situations.includes('portrait') || o.recipe.tags.includes('portrait')) {
        expect(s.colorPhase, `${o.recipe.id} is a portrait recipe`).toBe(0);
      }
    }
  });

  it('never set Color Depth to either end of its range', () => {
    for (const o of ORIGINAL_PP) {
      const s = ppOf(o)!;
      for (const c of PP_COLOR_DEPTH_CHANNELS) {
        expect(Math.abs(s.colorDepth[c]), `${o.recipe.id} ${c}`).toBeLessThan(PP_RANGES.colorDepth.max);
      }
    }
  });

  it('pair Gamma and Color Mode as Sony documents, or say why not', () => {
    for (const o of ORIGINAL_PP) {
      const s = ppOf(o)!;
      if (documentedPair(s.gamma, s.colorMode)) continue;
      /* The set's one exception: Cine3 or Cine4 contrast with Still colour. */
      expect(['Cine3', 'Cine4'], `${o.recipe.id} ${s.gamma}/${s.colorMode}`).toContain(s.gamma);
      expect(s.colorMode, o.recipe.id).toBe('Still');
      expect(o.intent, `${o.recipe.id} must state the exception`).toMatch(/Still colour/);
    }
  });

  it('have an English and a Vietnamese description, and an intent', () => {
    for (const o of ALL) {
      expect(o.description.trim().length, o.recipe.id).toBeGreaterThan(40);
      expect(o.intent.trim().length, o.recipe.id).toBeGreaterThan(0);
      expect(vi[o.recipe.id]?.trim().length ?? 0, `${o.recipe.id} has no VI description`).toBeGreaterThan(40);
    }
  });

  it('are placed in the taxonomy manifest, in known situations only', () => {
    for (const o of ALL) {
      const entry = TAXONOMY_MANIFEST[o.recipe.id];
      expect(entry, `${o.recipe.id} has no manifest entry`).toBeDefined();
      expect(entry?.style, o.recipe.id).toBeDefined();
      expect(entry?.tone, o.recipe.id).toBeDefined();
      for (const s of entry?.situations ?? []) expect(parseSituation(s), `${o.recipe.id}: ${s}`).not.toBeNull();
    }
  });

  it('describe a Creative Look with Creative Look settings only', () => {
    /* A stray Picture Profile key is a schema error, not a dropped field. */
    for (const o of ORIGINAL_CL) {
      const withPp = { ...o.recipe, settings: { ...o.recipe.settings, blackLevel: 0 } } as unknown as Recipe;
      expect(recipeSchema.safeParse(withPp).success, o.recipe.id).toBe(false);
    }
  });
});

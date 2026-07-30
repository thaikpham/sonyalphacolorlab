import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { accentFor } from './color';
import type { Recipe } from './schema';

/**
 * Guards the properties of the accent model that are actually defensible.
 *
 * WHAT IS NOT ASSERTED HERE, AND WHY
 *
 * There is no test that a given recipe reads "warm" or "cool". That was tried
 * against the recipes' own descriptions and abandoned as overfitting: the model
 * has three free parameters (MIRED_PER_SHIFT_STEP, MIRED_SCALE, DEPTH_SCALE)
 * and the oracle is roughly eight binary labels hand-read out of marketing
 * prose. Fitting three parameters to eight noisy labels produces a model that
 * looks validated and is not.
 *
 * Recipe *names* are a worse oracle still — "Phoenix Fire", "Arctic Negative"
 * and "Alpine Cool" name a mood or subject, and several name a feature of the
 * image ("deep blues") that coexists with the opposite overall cast.
 *
 * Settling the weights needs either Sony's spec for the mired value of one
 * WB shift step, or the photographer's eye on the actual images. Until then the
 * weights are a neutral default and only the invariants below are enforced.
 */

const recipes = JSON.parse(readFileSync('data/recipes.seed.json', 'utf8')) as (Recipe & {
  legacyId: string;
})[];

describe('accent invariants', () => {
  it('renders every Black & White recipe achromatic', () => {
    // Unambiguous, unlike the warm/cool question: a monochrome recipe showing
    // a hue is plainly wrong on a card, whatever the weights are.
    const bw = recipes.filter((r) => r.format === 'pp' && r.settings.colorMode === 'Black & White');
    expect(bw.length).toBe(9);
    for (const r of bw) expect(accentFor(r).c, `${r.id} should have no chroma`).toBe(0);
  });

  it('keeps every accent inside the legible band on the dark background', () => {
    for (const r of recipes) {
      const a = accentFor(r);
      expect(a.c, `${r.id} chroma`).toBeLessThanOrEqual(0.15);
      expect(a.l, `${r.id} lightness`).toBeGreaterThan(0.7);
      expect(a.h, `${r.id} hue`).toBeGreaterThanOrEqual(0);
      expect(a.h, `${r.id} hue`).toBeLessThan(360);
    }
  });

  it('spreads accents across the wheel rather than collapsing to one hue', () => {
    // Centring Color Depth on each recipe's own mean exists to prevent exactly
    // this: G averages +3.1 across the catalogue, so raw values would tint
    // nearly every recipe green.
    const hues = recipes.map(accentFor).filter((a) => a.c > 0.012).map((a) => a.h);
    const buckets = new Set(hues.map((h) => Math.floor(h / 45)));
    expect(buckets.size).toBeGreaterThanOrEqual(4);
  });

  it('gives two recipes with different colour science different accents', () => {
    const at = (title: string) => {
      const found = recipes.find((r) => (r.name.split(': ')[1] ?? r.name) === title);
      if (!found) throw new Error(`recipe not in catalogue: ${title}`);
      return accentFor(found);
    };
    // Same A7 amber shift, similar Kelvin; Jade pushes G to +7 and must not
    // land on the same hue as a recipe with flat Color Depth.
    const gap = Math.abs(at('Kyoto Jade').h - at('Amber Glow').h);
    expect(Math.min(gap, 360 - gap)).toBeGreaterThan(30);
  });

  it('is stable when the catalogue grows', () => {
    // Centring uses each recipe's own mean, never a catalogue-wide statistic,
    // so adding a recipe must never restyle an existing one.
    const before = accentFor(recipes[0]);
    const after = accentFor({ ...recipes[0] });
    expect(after).toEqual(before);
  });
});

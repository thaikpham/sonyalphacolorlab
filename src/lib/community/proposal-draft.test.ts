import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { CL_RANGES, PP_RANGES } from '@/lib/camera/constants';
import { clSettingsSchema, ppSettingsSchema, type Recipe } from '@/lib/camera/schema';
import { kneeForMode, proposalPills, stepInRange } from './proposal-draft';

/* Real recipes from the seed, never settings typed from memory (Rule 1). */
const seed = JSON.parse(readFileSync('data/recipes.seed.json', 'utf8')) as Recipe[];
const PP = seed.find((r) => r.format === 'pp')!;
const CL = seed.find((r) => r.format === 'cl')!;
if (PP.format !== 'pp' || CL.format !== 'cl') throw new Error('seed has no recipe of each format');

const withKnee = (knee: unknown) => ({ ...PP.settings, knee });

describe('kneeForMode', () => {
  const auto = { mode: 'Auto', maxPoint: PP_RANGES.kneeAutoMaxPoint.max, sensitivity: 'Mid' };

  it('builds a fresh Manual knee that the strict schema accepts', () => {
    /* Spreading the old object gave {mode:'Manual', maxPoint, sensitivity} —
       no point, no slope, two keys from the other branch — and the editor
       displayed an invented 75% beside it. */
    const knee = kneeForMode('Manual', auto);
    expect(knee).not.toHaveProperty('maxPoint');
    expect(knee).not.toHaveProperty('sensitivity');
    expect(ppSettingsSchema.safeParse(withKnee(knee)).success).toBe(true);
  });

  it('takes the Manual values from constants.ts, not a number typed here', () => {
    expect(kneeForMode('Manual', auto)).toEqual({
      mode: 'Manual',
      point: PP_RANGES.kneeManualPoint.min,
      slope: PP_RANGES.kneeManualSlope.min,
    });
  });

  it('drops point and slope when switching to Auto', () => {
    const manual = { mode: 'Manual', point: 92.5, slope: 1 };
    const knee = kneeForMode('Auto', manual);
    expect(knee).toEqual({ mode: 'Auto' });
    expect(ppSettingsSchema.safeParse(withKnee(knee)).success).toBe(true);
  });

  it("gives back the recipe's own knee when switching back to its mode", () => {
    const manual = { mode: 'Manual', point: 92.5, slope: 1 };
    expect(kneeForMode('Manual', manual)).toEqual(manual);
    expect(kneeForMode('Auto', auto)).toEqual(auto);
  });

  it('never returns a mode the camera does not have', () => {
    const knee = kneeForMode('Sideways', auto);
    expect(ppSettingsSchema.safeParse(withKnee(knee)).success).toBe(true);
  });
});

describe('stepInRange', () => {
  it('steps by the range’s own increment, so 92.5 can be reached again', () => {
    /* The knee point stepper added a hard-coded ±5, so from the corpus value
       92.5 the sequence ran 97.5, 102.5, 105, 100, 95 — never 92.5 again. */
    const up = stepInRange(92.5, 1, PP_RANGES.kneeManualPoint);
    expect(up).toBe(93);
    expect(stepInRange(up, -1, PP_RANGES.kneeManualPoint)).toBe(92.5);
  });

  it('stops at the bounds', () => {
    expect(stepInRange(PP_RANGES.kneeManualPoint.max, 1, PP_RANGES.kneeManualPoint)).toBe(
      PP_RANGES.kneeManualPoint.max,
    );
    expect(stepInRange(CL_RANGES.sharpnessRange.min, -1, CL_RANGES.sharpnessRange)).toBe(
      CL_RANGES.sharpnessRange.min,
    );
  });
});

describe('proposalPills', () => {
  it('never signs an unsigned Creative Look parameter (Rule 1)', () => {
    const pills = proposalPills('cl', { fade: 3, clarity: 2, sharpness: 4, contrast: 2 });
    expect(pills).toContain('Fade: 3');
    expect(pills).toContain('Clarity: 2');
    expect(pills).toContain('Sharpness: 4');
    expect(pills).toContain('Contrast: +2');
  });

  it('draws no pills for a settings value that is not an object', () => {
    /* Rows written before the POST validated strictly only had to be truthy,
       so jsonb can hold a bare string or number. `in` throws on either, and
       one such row took down the section for every reader of the recipe. */
    for (const settings of ['x', 5, true, null, ['look']]) {
      expect(proposalPills('pp', settings)).toEqual([]);
      expect(proposalPills('cl', settings)).toEqual([]);
    }
  });

  it('labels from constants.ts, never the raw JSON key', () => {
    const pills = proposalPills('pp', { blackLevel: 3, colorPhase: -1 });
    expect(pills).toEqual(['Black Level: +3', 'Color Phase: -1']);
  });

  it('orders by the camera’s menu, not by jsonb’s shortest-key-first', () => {
    const { look, fade, contrast } = CL.settings;
    const pills = proposalPills('cl', { fade, look, contrast });
    expect(pills[0]).toBe(`Creative Look: ${look}`);
    expect(pills[1]).toMatch(/^Contrast: /);
    expect(pills[2]).toMatch(/^Fade: /);
  });

  it('prints only what a knee stores', () => {
    expect(proposalPills('pp', { knee: { mode: 'Manual', point: 92.5, slope: 1 } })).toEqual([
      'Knee: Manual 92.5% +1',
    ]);
    expect(proposalPills('pp', { knee: { mode: 'Auto' } })).toEqual(['Knee: Auto']);
  });

  it('caps the row and skips keys the format does not have', () => {
    expect(proposalPills('pp', PP.settings)).toHaveLength(6);
    expect(proposalPills('pp', { look: 'FL', blackLevel: 0 })).toEqual(['Black Level: 0']);
  });

  it('formats every seed recipe without falling back to JSON', () => {
    for (const r of seed) {
      const settings = r.settings as Record<string, unknown>;
      for (const pill of proposalPills(r.format, settings, Infinity)) {
        expect(pill).not.toMatch(/[{}"]/);
      }
    }
    expect(clSettingsSchema.safeParse(CL.settings).success).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import legacyRecipes from './recipes.legacy.js';
import { LEGACY_CORRECTIONS, migrateAll, toRecipeId, toSlug } from './migrate';

const { ok, failed } = migrateAll(legacyRecipes as Record<string, unknown>[]);

describe('legacy migration', () => {
  it('carries over every recipe from the original dataset', () => {
    expect(legacyRecipes).toHaveLength(46);
    // Surface the actual reason on failure instead of a bare count mismatch.
    expect(failed.map((f) => `${f.legacyId}: ${f.error}`)).toEqual([]);
    expect(ok).toHaveLength(46);
  });

  it('produces unique ids and slugs', () => {
    expect(new Set(ok.map((r) => r.recipe.id)).size).toBe(46);
    expect(new Set(ok.map((r) => r.recipe.slug)).size).toBe(46);
  });

  it('maps ids into the SCL-PP-NNN scheme', () => {
    expect(toRecipeId('scl-001')).toBe('SCL-PP-001');
    expect(toRecipeId('scl-44')).toBe('SCL-PP-044');
    expect(toRecipeId('PROCOLOR-001')).toBe('SCL-PP-045');
  });

  it('derives slugs from the display name', () => {
    expect(toSlug('SCL-001: Mojave Sun')).toBe('mojave-sun');
    expect(toSlug('PROCOLOR-003: EXTRA DR Stream 109')).toBe('extra-dr-stream-109');
  });

  it('renumbers the name to match the new id', () => {
    const first = ok.find((r) => r.recipe.id === 'SCL-PP-001')!;
    expect(first.recipe.name).toBe('SCL-PP-001: Mojave Sun');
  });

  it('applies only the corrections that are documented', () => {
    const corrected = ok.filter((r) => r.corrections > 0).map((r) => r.legacyId);
    expect(corrected).toEqual(Object.keys(LEGACY_CORRECTIONS));
  });

  it('every correction states a reason', () => {
    for (const fixes of Object.values(LEGACY_CORRECTIONS)) {
      for (const fix of fixes) expect(fix.why.length).toBeGreaterThan(20);
    }
  });
});

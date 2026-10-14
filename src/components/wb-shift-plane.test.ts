import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The White Balance Shift grid on the recipe page.
 *
 * Source assertions: the component is an async Server Component reading
 * `next-intl/server`, and what has to hold is two numbers and a colour.
 */

const source = readFileSync('src/components/wb-shift-plane.tsx', 'utf8');

/* The SVG is drawn at most 16rem (256px) wide over a 200-unit viewBox, a
   scale of 1.28. The 13px floor (rule 2) is therefore 13 / 1.28 units. */
const FLOOR_UNITS = 13 / ((16 * 16) / 200);

describe('WbShiftPlane', () => {
  it('draws the axis letters at or above the 13px floor', () => {
    const sizes = [...source.matchAll(/fontSize="([\d.]+)"/g)].map((m) => Number(m[1]));
    expect(sizes.length).toBeGreaterThan(0);
    for (const s of sizes) expect(s).toBeGreaterThanOrEqual(FLOOR_UNITS);
  });

  it('colours its letters and neutral marks from the ink ramp, not a fourth step', () => {
    expect(source).not.toMatch(/oklch\(54%/);
    expect(source).toContain('var(--color-ink-faint)');
  });

  /* The only caller is the recipe page, which plots one recipe and passed
     `caption={false}`: the tally branch and its message were unreachable. */
  it('has no caption branch, and its message is gone from both catalogues', () => {
    expect(source).not.toContain('figcaption');
    expect(source).not.toContain('planeCaption');
    for (const l of ['en', 'vi']) {
      const m = JSON.parse(readFileSync(`messages/${l}.json`, 'utf8')) as { home: object };
      expect(m.home, l).not.toHaveProperty('planeCaption');
    }
  });
});

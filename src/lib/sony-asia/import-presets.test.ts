import { describe, expect, it, vi } from 'vitest';

/**
 * Rule 5: adding a White Balance preset touches `constants.ts` only. The
 * importer used to retype the preset list in its own regex, so a preset added
 * there was never found in a scraped row and the row was skipped as stating
 * "no White Balance". A file of its own because `vi.mock` replaces the module
 * for every test in the file.
 */
const ADDED = 'Test Preset';

vi.mock('../camera/constants', async (importOriginal) => {
  const real = await importOriginal<typeof import('../camera/constants')>();
  return { ...real, WB_PRESETS: [...real.WB_PRESETS, ADDED] };
});

const { importSonyAsia } = await import('./import');

describe('a preset added to constants.ts', () => {
  it('is read from a scraped row with no change to the importer', () => {
    const data = `ST (Standard) | Contrast 0, Highlights 0, Shadows 0, Fade 0, Saturation 0, Sharpness 4, Sharpness Range 3, Clarity 1, WB ${ADDED} A1`;
    const csv = `name,data,data3\nTest,"${data}",Testland\n`;
    const { recipes, skipped } = importSonyAsia(csv);
    expect(skipped).toEqual([]);
    expect(recipes[0]?.whiteBalance).toEqual({
      mode: 'preset',
      preset: ADDED,
      shift: { ab: { axis: 'A', amount: 1 } },
    });
  });
});

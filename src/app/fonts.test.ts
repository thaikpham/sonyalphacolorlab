import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Guards the Vietnamese subset.
 *
 * Dropping `'vietnamese'` from a next/font call does not error and does not
 * fail a build — Vietnamese text just silently falls back mid-word to whatever
 * the system has, which is the exact font-breaking this project exists to
 * avoid. Verified in-browser at the pixel level (ế ộ ữ ằ đ all render from
 * Noto Sans); this test keeps it from regressing.
 */
const fonts = readFileSync('src/app/fonts.ts', 'utf8');

describe('font loading', () => {
  it('requests the vietnamese subset for every font', () => {
    const calls = [...fonts.matchAll(/subsets:\s*\[([^\]]*)\]/g)];
    expect(calls.length, 'no next/font subsets found in fonts.ts').toBeGreaterThan(0);
    for (const c of calls) expect(c[1]).toContain('vietnamese');
  });

  it('uses Noto Sans for both roles', () => {
    expect(fonts).toMatch(/Noto_Sans\s*\(/);
    expect(fonts).toMatch(/Noto_Sans_Mono\s*\(/);
  });
});

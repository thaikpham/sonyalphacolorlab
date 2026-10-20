import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import seed from '../../../data/recipes.seed.json';
import type { RecipeView } from '../recipes/source';
import type { ClSettings, PpSettings } from '../camera/schema';
import { TWEAK_REQUEST_MAX, TWEAK_REQUEST_MIN, tweakDiff } from './tweak-form';

const recipes = seed as unknown as RecipeView[];
const pp = recipes.find((r) => r.format === 'pp')!;
const cl = recipes.find((r) => r.format === 'cl')!;
const ppSettings = pp.settings as PpSettings;
const clSettings = cl.settings as ClSettings;

/**
 * The AI result is shown as a before/after list beside the settings table, so
 * it has to read the way that table does. It used to print the schema paths —
 * `detail.hiLightDetail`, `colorDepth.R`, `whiteBalance` — and `String(v)`, so
 * Black Level +3 → +5 read "3 → 5" next to a table that said "+3".
 */
describe('tweakDiff', () => {
  it('labels rows the way the camera does, never by schema path', () => {
    const rows = tweakDiff('pp', pp, pp);
    for (const r of rows) expect(r.label, r.key).not.toMatch(/\./);
    expect(rows.map((r) => r.label)).toEqual(
      expect.arrayContaining(['White Balance', 'Black Level', 'Color Depth R', 'Detail Hi-Light Detail']),
    );
    expect(rows.every((r) => !r.changed)).toBe(true);
  });

  it('signs a signed Picture Profile dial', () => {
    const after = { ...pp, settings: { ...ppSettings, blackLevel: 5 } };
    const row = tweakDiff('pp', { ...pp, settings: { ...ppSettings, blackLevel: 3 } }, after).find(
      (r) => r.key === 'blackLevel',
    );
    expect(row).toMatchObject({ label: 'Black Level', from: '+3', to: '+5', changed: true });
  });

  it('never signs an unsigned dial', () => {
    const before = { ...cl, settings: { ...clSettings, fade: 2 } };
    const after = { ...cl, settings: { ...clSettings, fade: 3 } };
    expect(tweakDiff('cl', before, after).find((r) => r.key === 'fade')).toMatchObject({
      label: 'Fade',
      from: '2',
      to: '3',
    });
  });

  it('formats White Balance as one row', () => {
    const after = {
      ...pp,
      whiteBalance: { mode: 'preset' as const, preset: 'Cloudy' as const },
    };
    expect(tweakDiff('pp', pp, after).find((r) => r.key === 'whiteBalance')).toMatchObject({
      label: 'White Balance',
      to: 'Cloudy',
      changed: true,
    });
  });
});

/**
 * The panel enabled submit for any non-empty text while the route required
 * three characters. "ấm" — Vietnamese for "warm" — is two, so it went out, cost
 * a rate-limit slot and a unit of the daily budget, and came back 400.
 */
describe('the request bounds', () => {
  const panel = readFileSync('src/components/tweak-panel.tsx', 'utf8');
  const route = readFileSync('src/app/api/tweak/route.ts', 'utf8');

  it('are one pair of constants the route and the panel both read', () => {
    expect(route).toMatch(/request: z\.string\(\)\.min\(TWEAK_REQUEST_MIN\)\.max\(TWEAK_REQUEST_MAX\)/);
    expect(panel).toMatch(/disabled=\{busy \|\| request\.trim\(\)\.length < TWEAK_REQUEST_MIN\}/);
    expect(panel).toMatch(/if \(request\.trim\(\)\.length < TWEAK_REQUEST_MIN \|\| busy\) return;/);
    expect(panel).toContain('maxLength={TWEAK_REQUEST_MAX}');
  });

  it('keep a one-word Vietnamese request on the client', () => {
    expect('ấm'.normalize('NFC').length).toBeLessThan(TWEAK_REQUEST_MIN);
    expect(TWEAK_REQUEST_MAX).toBe(500);
  });
});

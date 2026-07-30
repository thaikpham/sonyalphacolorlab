import { describe, expect, it } from 'vitest';
import { accentCss, accentFor, accentHex, shiftPosition } from './color';
import type { WhiteBalance } from './schema';

const wb = (kelvin: number, shift?: WhiteBalance['shift']): WhiteBalance => ({
  mode: 'kelvin',
  kelvin,
  ...(shift ? { shift } : {}),
});

/** Flat Color Depth, so these cases isolate the White Balance contribution. */
const flatDepth = { R: 0, G: 0, B: 0, C: 0, M: 0, Y: 0 };

const k = (kelvin: number, shift?: WhiteBalance['shift']) =>
  ({
    format: 'pp' as const,
    whiteBalance: wb(kelvin, shift),
    settings: { colorMode: 'Pro', colorDepth: flatDepth },
  }) as Parameters<typeof accentFor>[0];

/** Shortest distance between two hues on the wheel. */
const hueGap = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));

describe('accent colour', () => {
  it('renders a neutral recipe achromatic', () => {
    const a = accentFor(k(5500));
    expect(a.c).toBe(0);
  });

  it('goes warm as Kelvin rises and cool as it falls', () => {
    // With flat Color Depth and no shift, Kelvin alone lands exactly on the
    // amber (65°) or blue (264°) axis.
    expect(hueGap(accentFor(k(9900)).h, 65)).toBeLessThan(20);
    expect(hueGap(accentFor(k(2500)).h, 264)).toBeLessThan(20);
  });

  it('gets more saturated the further from neutral', () => {
    expect(accentFor(k(9900)).c).toBeGreaterThan(accentFor(k(6500)).c);
    expect(accentFor(k(6500)).c).toBeGreaterThan(accentFor(k(5600)).c);
  });

  it('pulls toward green on a G shift and magenta on an M shift', () => {
    const green = accentFor(k(5500, { gm: { axis: 'G', amount: 5 } }));
    const magenta = accentFor(k(5500, { gm: { axis: 'M', amount: 5 } }));
    expect(hueGap(green.h, 145)).toBeLessThan(30);
    expect(hueGap(magenta.h, 325)).toBeLessThan(30);
  });

  it('lets a blue shift cool down a warm Kelvin', () => {
    // A full B7 shift is worth more than 8000K is warm, so it does not merely
    // neutralise the cast — it carries the accent across into the cool half.
    // Chroma therefore rises again on the far side; hue is what to assert.
    const warm = accentFor(k(8000));
    const cooled = accentFor(k(8000, { ab: { axis: 'B', amount: 7 } }));
    expect(hueGap(warm.h, 65)).toBeLessThan(45);
    expect(hueGap(cooled.h, 264)).toBeLessThan(45);
  });

  it('passes through neutral where the shift exactly cancels the Kelvin', () => {
    // 8000K is +57 mired; the cancelling blue shift is 57/17 ≈ 3.35 steps.
    const balanced = accentFor(k(8000, { ab: { axis: 'B', amount: 3.25 } }));
    expect(balanced.c).toBeLessThan(0.02);
  });

  it('keeps every real recipe legible on the dark background', () => {
    // Lightness stays high and chroma capped, so no accent vibrates or vanishes.
    const extremes = [k(2500), k(9900), k(9900, { ab: { axis: 'A', amount: 7 }, gm: { axis: 'M', amount: 7 } })];
    for (const wb of extremes) {
      const a = accentFor(wb);
      expect(a.c).toBeLessThanOrEqual(0.15);
      expect(a.l).toBeGreaterThan(0.7);
      expect(a.h).toBeGreaterThanOrEqual(0);
      expect(a.h).toBeLessThan(360);
    }
  });

  it('treats AWB with no shift as neutral', () => {
    expect(accentFor({ format: 'pp', whiteBalance: { mode: 'auto', auto: 'AWB' }, settings: { colorMode: 'Pro', colorDepth: flatDepth } } as Parameters<typeof accentFor>[0]).c).toBe(0);
  });

  it('emits valid CSS', () => {
    expect(accentCss(accentFor(k(7000)))).toMatch(/^oklch\(\d+\.\d% [\d.]+ [\d.]+\)$/);
  });
});

describe('OKLCH to sRGB hex', () => {
  // Renderers that cannot parse oklch() (Satori / next/og) depend on this.
  it('emits a 6-digit hex', () => {
    expect(accentHex(accentFor(k(7000)))).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('converts a neutral accent to a grey with equal channels', () => {
    const hex = accentHex(accentFor(k(5500)));
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    expect(Math.abs(r - g)).toBeLessThanOrEqual(1);
    expect(Math.abs(g - b)).toBeLessThanOrEqual(1);
  });

  it('puts red above blue when warm, and the reverse when cool', () => {
    const parse = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const [wr, , wb] = parse(accentHex(accentFor(k(9900))));
    const [cr, , cb] = parse(accentHex(accentFor(k(2500))));
    expect(wr).toBeGreaterThan(wb);
    expect(cb).toBeGreaterThan(cr);
  });

  it('stays in gamut for every real recipe', () => {
    for (const wb of [k(2500), k(9900), k(5500), k(9900, { gm: { axis: 'M', amount: 7 } })]) {
      expect(accentHex(accentFor(wb))).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

describe('shift position', () => {
  it('places a neutral recipe at the origin', () => {
    expect(shiftPosition(wb(7000))).toEqual({ x: 0, y: 0 });
  });

  it('normalises the axes to -1..1 and ignores Kelvin', () => {
    expect(shiftPosition(wb(3000, { ab: { axis: 'A', amount: 7 }, gm: { axis: 'G', amount: 7 } })))
      .toEqual({ x: 1, y: -1 });
    expect(shiftPosition(wb(9000, { ab: { axis: 'B', amount: 3.5 } })).x).toBe(-0.5);
  });
});

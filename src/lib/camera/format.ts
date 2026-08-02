/**
 * Display formatting and legacy parsing for camera values.
 *
 * The canonical stored form is structured (see `schema.ts`); these helpers
 * render it the way the camera and the old site display it, and parse the
 * legacy string form used by the original sonycolorlab dataset.
 */

import {
  CL_SIGNED_PARAMS,
  WB_AUTO_MODES,
  WB_PRESETS,
  type ClParam,
} from './constants';
import type { WhiteBalance } from './schema';

/** `3` -> "3", `1.5` -> "1.5", `0.25` -> "0.25" */
const num = (n: number) => String(n);

/** Renders a value with an explicit sign, the way the camera shows it. */
export const signed = (n: number) => (n > 0 ? `+${num(n)}` : num(n));

/**
 * Formats a Creative Look parameter. Signed params get an explicit +/-;
 * unsigned ones (fade, sharpness, sharpnessRange, clarity) never do.
 */
export function formatClValue(param: ClParam, value: number): string {
  return (CL_SIGNED_PARAMS as readonly string[]).includes(param) ? signed(value) : num(value);
}

/**
 * The White Balance value without its shift — "7000K", "AWB", "Cloudy".
 *
 * Exported because the UI colours the head and the shift differently and so
 * cannot use `formatWhiteBalance`'s joined string. One place owns the three-way
 * branch; adding a fourth WB mode should not mean hunting for ternaries.
 */
export function wbHeadLabel(wb: WhiteBalance): string {
  if (wb.mode === 'kelvin') return `${wb.kelvin}K`;
  if (wb.mode === 'preset') return wb.preset;
  return wb.auto;
}

/** "7000K, B3-M1.5" | "5500K" | "AWB, A3" | "Cloudy, A1.5-M0.5" */
export function formatWhiteBalance(wb: WhiteBalance): string {
  const head = wbHeadLabel(wb);
  if (!wb.shift) return head;
  const parts: string[] = [];
  if (wb.shift.ab) parts.push(`${wb.shift.ab.axis}${num(wb.shift.ab.amount)}`);
  if (wb.shift.gm) parts.push(`${wb.shift.gm.axis}${num(wb.shift.gm.amount)}`);
  return `${head}, ${parts.join('-')}`;
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Longest-first, so "Fluor.: Daylight" is not consumed by the "Daylight"
 * branch — regex alternation takes the first match, not the best one.
 */
const byLengthDesc = (a: string, b: string) => b.length - a.length;

const WB_RE = new RegExp(
  '^\\s*(?:(\\d{3,4})K|(' +
    [...WB_AUTO_MODES].sort(byLengthDesc).map(esc).join('|') +
    ')|(' +
    [...WB_PRESETS].sort(byLengthDesc).map(esc).join('|') +
    '))' +
    '(?:\\s*,\\s*(?:([AB])(\\d+(?:\\.\\d+)?))?(?:-?([GM])(\\d+(?:\\.\\d+)?))?)?\\s*$',
);

/**
 * Parses the legacy string form into the structured shape.
 * Returns null when the string does not match, so migration fails loudly
 * rather than silently inventing a value.
 */
export function parseWhiteBalance(input: string): WhiteBalance | null {
  const m = WB_RE.exec(input);
  if (!m) return null;
  const [, kelvin, auto, preset, abAxis, abAmt, gmAxis, gmAmt] = m;

  const shift =
    abAxis || gmAxis
      ? {
          ...(abAxis ? { ab: { axis: abAxis as 'A' | 'B', amount: Number(abAmt) } } : {}),
          ...(gmAxis ? { gm: { axis: gmAxis as 'G' | 'M', amount: Number(gmAmt) } } : {}),
        }
      : undefined;
  const tail = shift ? { shift } : {};

  if (kelvin) return { mode: 'kelvin', kelvin: Number(kelvin), ...tail };
  if (preset) return { mode: 'preset', preset: preset as (typeof WB_PRESETS)[number], ...tail };
  return { mode: 'auto', auto: auto as (typeof WB_AUTO_MODES)[number], ...tail };
}

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
  type ClParam,
  type Range,
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

/** "7000K, B3-M1.5" | "5500K" | "AWB, A3" | "AWB (Priority White)" */
export function formatWhiteBalance(wb: WhiteBalance): string {
  const head = wb.mode === 'kelvin' ? `${wb.kelvin}K` : wb.auto;
  if (!wb.shift) return head;
  const parts: string[] = [];
  if (wb.shift.ab) parts.push(`${wb.shift.ab.axis}${num(wb.shift.ab.amount)}`);
  if (wb.shift.gm) parts.push(`${wb.shift.gm.axis}${num(wb.shift.gm.amount)}`);
  return `${head}, ${parts.join('-')}`;
}

const WB_RE = new RegExp(
  '^\\s*(?:(\\d{3,4})K|(' +
    WB_AUTO_MODES.map((m) => m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') +
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
  const [, kelvin, auto, abAxis, abAmt, gmAxis, gmAmt] = m;

  const shift =
    abAxis || gmAxis
      ? {
          ...(abAxis ? { ab: { axis: abAxis as 'A' | 'B', amount: Number(abAmt) } } : {}),
          ...(gmAxis ? { gm: { axis: gmAxis as 'G' | 'M', amount: Number(gmAmt) } } : {}),
        }
      : undefined;

  if (kelvin) return { mode: 'kelvin', kelvin: Number(kelvin), ...(shift ? { shift } : {}) };
  return {
    mode: 'auto',
    auto: auto as (typeof WB_AUTO_MODES)[number],
    ...(shift ? { shift } : {}),
  };
}

/** Renders a Range as the camera documents it, e.g. "-9 to +9" or "1 to 5". */
export function describeRange(range: Range): string {
  const lo = range.min < 0 ? signed(range.min) : num(range.min);
  const hi = range.max > 0 && range.min < 0 ? signed(range.max) : num(range.max);
  return `${lo} to ${hi}`;
}

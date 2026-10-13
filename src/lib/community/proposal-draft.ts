/**
 * The proposal editor's camera logic, apart from the component that draws it.
 *
 * Every function here writes or prints a camera value, so every one reads its
 * range, label or enum from constants.ts (Rule 1). They lived inline in
 * `recipe-community-section.tsx`, where each had quietly drifted from that
 * file: a knee mode switch that merged two branches of a discriminated union,
 * a stepper that added ±5 to a 0.5-step range, and pills that printed
 * `fade: +3` for a parameter the camera never signs.
 */

import {
  CL_PARAM_LABELS,
  CL_PARAM_ORDER,
  PP_COLOR_DEPTH_CHANNELS,
  PP_DETAIL_LABELS,
  PP_KNEE_MODE,
  PP_PARAM_LABELS,
  PP_RANGES,
  type ClParam,
  type Range,
} from '@/lib/camera/constants';
import { formatClValue, signed } from '@/lib/camera/format';
import type { PpSettings } from '@/lib/camera/schema';

/**
 * One press of a stepper: one camera increment in `direction`, kept in range
 * and snapped to the step so float drift cannot produce a value the schema
 * rejects on submit.
 */
export function stepInRange(current: number, direction: -1 | 1, range: Range): number {
  const bounded = Math.min(range.max, Math.max(range.min, current + direction * range.step));
  return Math.round(bounded / range.step) * range.step;
}

type Knee = PpSettings['knee'];

/**
 * The knee for a mode, built fresh.
 *
 * The two modes are a discriminated union with no field in common, and both
 * branches are `strictObject`, so a merge is always wrong: Auto→Manual left
 * `maxPoint` and `sensitivity` beside a missing `point` and `slope`, and the
 * server refuses the proposal. Switching back to the recipe's own mode gives
 * its own values back; otherwise Manual starts at the range minima — the same
 * legal-by-construction choice `/admin`'s editor makes — and Auto carries no
 * optional field, since the camera picks them.
 */
export function kneeForMode(mode: string, recipeKnee: unknown): Knee {
  const next = (PP_KNEE_MODE as readonly string[]).includes(mode)
    ? (mode as Knee['mode'])
    : PP_KNEE_MODE[0];
  const own = recipeKnee as Partial<Knee> | null | undefined;
  if (own?.mode === next) return { ...(own as Knee) };
  return next === 'Manual'
    ? { mode: 'Manual', point: PP_RANGES.kneeManualPoint.min, slope: PP_RANGES.kneeManualSlope.min }
    : { mode: 'Auto' };
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

/** One Picture Profile setting as a pill, or null when it cannot be shown truthfully. */
function ppPill(key: keyof typeof PP_PARAM_LABELS, value: unknown): string | null {
  const label = PP_PARAM_LABELS[key];
  if (key === 'blackGamma' && isObj(value)) {
    const parts = [typeof value.range === 'string' ? value.range : null, isNum(value.level) ? signed(value.level) : null];
    return `${label}: ${parts.filter(Boolean).join(' ')}`;
  }
  if (key === 'knee' && isObj(value)) {
    /* Only what the knee stores. The old pill printed `point ?? 75` and a
       slope of 0 for a Manual knee that had neither. */
    const parts = [String(value.mode ?? '')];
    if (value.mode === 'Manual') {
      if (isNum(value.point)) parts.push(`${value.point}%`);
      if (isNum(value.slope)) parts.push(signed(value.slope));
    } else {
      if (isNum(value.maxPoint)) parts.push(`${value.maxPoint}%`);
      if (typeof value.sensitivity === 'string') parts.push(value.sensitivity);
    }
    return `${label}: ${parts.join(' ')}`;
  }
  if (key === 'colorDepth' && isObj(value)) {
    const parts = PP_COLOR_DEPTH_CHANNELS.filter((ch) => isNum(value[ch])).map(
      (ch) => `${ch}${signed(value[ch] as number)}`,
    );
    return `${label}: ${parts.join(' ')}`;
  }
  if (key === 'detail' && isObj(value)) {
    return isNum(value.level) ? `${label} ${PP_DETAIL_LABELS.level}: ${signed(value.level)}` : null;
  }
  if (isNum(value)) return `${label}: ${signed(value)}`;
  if (typeof value === 'string') return `${label}: ${value}`;
  return null;
}

/** One Creative Look setting as a pill. Unsigned parameters never carry a `+`. */
function clPill(key: 'look' | ClParam, value: unknown): string | null {
  if (key === 'look') return typeof value === 'string' ? `Creative Look: ${value}` : null;
  return isNum(value) ? `${CL_PARAM_LABELS[key]}: ${formatClValue(key, value)}` : null;
}

const PP_ORDER = Object.keys(PP_PARAM_LABELS) as (keyof typeof PP_PARAM_LABELS)[];
const CL_ORDER = ['look', ...CL_PARAM_ORDER] as const;

/**
 * A proposal's settings as the pills on its card, in the camera's menu order.
 *
 * Postgres jsonb stores keys shortest-first, so the old `Object.entries`
 * order put a Creative Look proposal's fade, look and clarity ahead of its
 * contrast. Keys the recipe's format does not have are skipped rather than
 * printed raw. The format is the recipe's: a proposal does not store one, and
 * the server holds its settings to that recipe's schema.
 *
 * `unknown`, because rows written before the POST validated strictly only had
 * to be truthy: jsonb can hold a bare string or number there, `in` throws on
 * one, and a single such row would take the section down for every reader.
 */
export function proposalPills(format: 'pp' | 'cl', settings: unknown, limit = 6): string[] {
  if (!isObj(settings)) return [];
  const pills =
    format === 'pp'
      ? PP_ORDER.filter((k) => k in settings).map((k) => ppPill(k, settings[k]))
      : CL_ORDER.filter((k) => k in settings).map((k) => clPill(k, settings[k]));
  return pills.filter((p): p is string => p !== null).slice(0, limit);
}

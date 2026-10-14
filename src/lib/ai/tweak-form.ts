/**
 * The parts of "Tweak with AI" the browser and the route share.
 *
 * Client-safe on purpose: `tweak.ts` is `server-only` because it holds the API
 * key, and anything the panel needs to agree with the route about lives here
 * instead of being retyped on either side.
 */

import {
  CL_PARAM_LABELS,
  CL_PARAM_ORDER,
  PP_COLOR_DEPTH_CHANNELS,
  PP_DETAIL_LABELS,
  PP_PARAM_LABELS,
  WB_PARAM_LABELS,
} from '../camera/constants';
import { formatClValue, formatWhiteBalance, signed } from '../camera/format';
import type { ClSettings, PpSettings, WhiteBalance } from '../camera/schema';

/**
 * Request length, in UTF-16 units of the trimmed text. The panel disabled its
 * button only on empty text while the route required three characters, so a
 * two-letter request went out, spent a rate-limit slot and a unit of the daily
 * budget, and came back 400.
 */
export const TWEAK_REQUEST_MIN = 3;
export const TWEAK_REQUEST_MAX = 500;

type Side = { whiteBalance: WhiteBalance; settings: PpSettings | ClSettings };
type Row = { key: string; label: string; value: string };

export type DiffRow = { key: string; label: string; from: string; to: string; changed: boolean };

/** Same readout as `PpTable`'s Knee row. */
const knee = (k: PpSettings['knee']) =>
  k.mode === 'Auto'
    ? `Auto${k.maxPoint ? ` ${k.maxPoint}%` : ''}${k.sensitivity ? ` ${k.sensitivity}` : ''}`
    : `Manual ${k.point}% ${signed(k.slope)}`;

/**
 * One recipe as the settings table reads it: labels from `constants.ts`, signed
 * dials with their `+`, unsigned ones (Limit, Fade, Clarity…) without.
 */
function rowsOf(format: 'pp' | 'cl', { whiteBalance, settings }: Side): Row[] {
  const wb: Row = {
    key: 'whiteBalance',
    label: WB_PARAM_LABELS.whiteBalance,
    value: formatWhiteBalance(whiteBalance),
  };

  if (format === 'cl') {
    const s = settings as ClSettings;
    return [
      wb,
      { key: 'look', label: 'Look', value: s.look },
      ...CL_PARAM_ORDER.flatMap((p) => {
        const v = s[p];
        // Saturation is absent on BW and SE — the camera greys it out.
        return v === undefined ? [] : [{ key: p, label: CL_PARAM_LABELS[p], value: formatClValue(p, v) }];
      }),
    ];
  }

  const s = settings as PpSettings;
  const detail = (k: keyof typeof PP_DETAIL_LABELS, value: string): Row => ({
    key: `detail.${k}`,
    label: `${PP_PARAM_LABELS.detail} ${PP_DETAIL_LABELS[k]}`,
    value,
  });
  return [
    wb,
    { key: 'blackLevel', label: PP_PARAM_LABELS.blackLevel, value: signed(s.blackLevel) },
    { key: 'gamma', label: PP_PARAM_LABELS.gamma, value: s.gamma },
    {
      key: 'blackGamma',
      label: PP_PARAM_LABELS.blackGamma,
      value: `${s.blackGamma.range} ${signed(s.blackGamma.level)}`,
    },
    { key: 'knee', label: PP_PARAM_LABELS.knee, value: knee(s.knee) },
    { key: 'colorMode', label: PP_PARAM_LABELS.colorMode, value: s.colorMode },
    { key: 'saturation', label: PP_PARAM_LABELS.saturation, value: signed(s.saturation) },
    { key: 'colorPhase', label: PP_PARAM_LABELS.colorPhase, value: signed(s.colorPhase) },
    ...PP_COLOR_DEPTH_CHANNELS.map((c) => ({
      key: `colorDepth.${c}`,
      label: `${PP_PARAM_LABELS.colorDepth} ${c}`,
      value: signed(s.colorDepth[c]),
    })),
    detail('level', signed(s.detail.level)),
    detail('mode', s.detail.mode),
    detail('vhBalance', signed(s.detail.vhBalance)),
    detail('bwBalance', s.detail.bwBalance),
    // Limit, Crispening and Hi-Light Detail are unsigned; no sign, by design.
    detail('limit', String(s.detail.limit)),
    detail('crispening', String(s.detail.crispening)),
    detail('hiLightDetail', String(s.detail.hiLightDetail)),
  ];
}

/** Before and after, row by row, in the settings table's order. */
export function tweakDiff(format: 'pp' | 'cl', before: Side, after: Side): DiffRow[] {
  const from = rowsOf(format, before);
  const to = new Map(rowsOf(format, after).map((r) => [r.key, r]));
  const rows: DiffRow[] = from.map((r) => {
    const next = to.get(r.key);
    to.delete(r.key);
    return {
      key: r.key,
      label: r.label,
      from: r.value,
      to: next?.value ?? '—',
      changed: r.value !== next?.value,
    };
  });
  /* Only a Creative Look's Saturation can appear on one side alone — the Look
     changed between colour and monochrome. */
  for (const r of to.values()) {
    rows.push({ key: r.key, label: r.label, from: '—', to: r.value, changed: true });
  }
  return rows;
}

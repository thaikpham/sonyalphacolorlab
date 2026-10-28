/**
 * The settings a new recipe starts from in the /admin editor, one per format:
 * every signed dial at zero and every unsigned one at its minimum. The recipe
 * name (`names.ts`) measures against the same dials, so the two read one
 * object rather than two copies.
 *
 * The Picture Profile's Gamma / Color Mode here (Cine1 with Pro) is only where
 * the editor opens a new recipe; the guide marks no default pair, and the name
 * measures against the pair it calls the rendering without a Picture Profile
 * instead, `PP_STANDARD_STILL`. The Creative Look is the first Look in
 * `CREATIVE_LOOKS`, ST (Standard).
 *
 * Every bound is read from `constants.ts` (Rule 1); the enum members are the
 * schema's own strings, which `satisfies` checks.
 */

import { CL_RANGES, CREATIVE_LOOK_CODES, PP_RANGES } from './constants';
import type { ClSettings, PpSettings } from './schema';

export const DEFAULT_PP_SETTINGS = {
  blackLevel: 0,
  gamma: 'Cine1',
  blackGamma: { range: 'Middle', level: 0 },
  knee: { mode: 'Auto' },
  colorMode: 'Pro',
  saturation: 0,
  colorPhase: 0,
  colorDepth: { R: 0, G: 0, B: 0, C: 0, M: 0, Y: 0 },
  detail: {
    level: 0,
    mode: 'Auto',
    vhBalance: 0,
    bwBalance: 'Type3',
    limit: PP_RANGES.detailLimit.min,
    crispening: PP_RANGES.detailCrispening.min,
    hiLightDetail: PP_RANGES.detailHiLightDetail.min,
  },
} as const satisfies PpSettings;

export const DEFAULT_CL_SETTINGS = {
  look: CREATIVE_LOOK_CODES[0],
  contrast: 0,
  highlights: 0,
  shadows: 0,
  fade: CL_RANGES.fade.min,
  saturation: 0,
  sharpness: CL_RANGES.sharpness.min,
  sharpnessRange: CL_RANGES.sharpnessRange.min,
  clarity: CL_RANGES.clarity.min,
} as const satisfies ClSettings;

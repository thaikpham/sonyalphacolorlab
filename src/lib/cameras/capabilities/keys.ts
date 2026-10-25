/**
 * The colour capabilities a camera body can have, in keys derived from
 * `constants.ts`.
 *
 * A capability key names one thing a body either has or lacks: a menu
 * (`picture-profile`, `creative-style`), an item in it (`pp.item:Knee`), one option of an item
 * (`pp.gamma:S-Cinetone`, `cl.look:FL`) or a White Balance control. Every key
 * is built from a constant, so a key cannot name a value `constants.ts` does
 * not hold, and a value added there gains its key without an edit here.
 *
 * The keys say nothing about whether any body has them. That is evidence
 * (`evidence.ts`), and a key without confirmed evidence for a body is simply
 * not listed for it — never assumed from the global enum: a value being legal
 * somewhere proves nothing about a particular camera.
 */

import {
  CL_PARAM_ORDER,
  CREATIVE_LOOKS,
  PP_COLOR_MODE,
  PP_GAMMA,
  PP_MENU_ITEMS,
  WB_AUTO_MODES,
  WB_PRESETS,
  type ClParam,
  type CreativeLookCode,
} from '@/lib/camera/constants'

export type PpMenuItem = (typeof PP_MENU_ITEMS)[number]
export type PpGamma = (typeof PP_GAMMA)[number]
export type PpColorMode = (typeof PP_COLOR_MODE)[number]
export type WbAutoMode = (typeof WB_AUTO_MODES)[number]
export type WbPreset = (typeof WB_PRESETS)[number]
export type ShiftAxis = 'ab' | 'gm'

export type CapabilityKey =
  | 'picture-profile'
  | `pp.item:${PpMenuItem}`
  | `pp.gamma:${PpGamma}`
  | `pp.colorMode:${PpColorMode}`
  | 'creative-look'
  | 'creative-style'
  | `cl.look:${CreativeLookCode}`
  | `cl.adjust:${ClParam}`
  | 'wb.kelvin'
  | `wb.auto:${WbAutoMode}`
  | `wb.preset:${WbPreset}`
  | `wb.shift:${ShiftAxis}`

export const CAPABILITY_KEYS: readonly CapabilityKey[] = [
  'picture-profile',
  ...PP_MENU_ITEMS.map((i) => `pp.item:${i}` as const),
  ...PP_GAMMA.map((g) => `pp.gamma:${g}` as const),
  ...PP_COLOR_MODE.map((m) => `pp.colorMode:${m}` as const),
  'creative-look',
  'creative-style',
  ...CREATIVE_LOOKS.map((l) => `cl.look:${l.code}` as const),
  ...CL_PARAM_ORDER.map((p) => `cl.adjust:${p}` as const),
  'wb.kelvin',
  ...WB_AUTO_MODES.map((m) => `wb.auto:${m}` as const),
  ...WB_PRESETS.map((p) => `wb.preset:${p}` as const),
  'wb.shift:ab',
  'wb.shift:gm',
]

const KEY_SET: ReadonlySet<string> = new Set(CAPABILITY_KEYS)

export function isCapabilityKey(value: string): value is CapabilityKey {
  return KEY_SET.has(value)
}

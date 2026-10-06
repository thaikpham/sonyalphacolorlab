/**
 * The colour capabilities a camera body can have, in keys derived from
 * `constants.ts`.
 *
 * A capability key names one thing a body either has or lacks: a menu
 * (`picture-profile`), an item in it (`pp.item:Knee`), one option of an item
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
  CL_PARAM_LABELS,
  CL_PARAM_ORDER,
  CREATIVE_LOOKS,
  PP_COLOR_MODE,
  PP_GAMMA,
  PP_MENU_ITEMS,
  PP_PARAM_LABELS,
  WB_AUTO_MODES,
  WB_PARAM_LABELS,
  WB_PRESETS,
  type ClParam,
  type CreativeLookCode,
  type PpColorMode,
  type PpGamma,
} from '@/lib/camera/constants'

export type PpMenuItem = (typeof PP_MENU_ITEMS)[number]
export type WbAutoMode = (typeof WB_AUTO_MODES)[number]
export type WbPreset = (typeof WB_PRESETS)[number]
export type ShiftAxis = 'ab' | 'gm'

export type CapabilityKey =
  | 'picture-profile'
  | `pp.item:${PpMenuItem}`
  | `pp.gamma:${PpGamma}`
  | `pp.colorMode:${PpColorMode}`
  | 'creative-look'
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

const LOOK_LABEL: Record<string, string> = Object.fromEntries(
  CREATIVE_LOOKS.map((l) => [l.code, `${l.code} (${l.label})`]),
)

/**
 * The name a reader sees for a key. Technical labels only — the same strings
 * the recipe tables print — so nothing here is translated (Rule 3).
 */
export function capabilityLabel(key: CapabilityKey): string {
  if (key === 'picture-profile') return 'Picture Profile'
  if (key === 'creative-look') return 'Creative Look'
  if (key === 'wb.kelvin') return WB_PARAM_LABELS.temperature
  if (key === 'wb.shift:ab') return WB_PARAM_LABELS.shiftAb
  if (key === 'wb.shift:gm') return WB_PARAM_LABELS.shiftGm
  const i = key.indexOf(':')
  const kind = key.slice(0, i)
  const value = key.slice(i + 1)
  switch (kind) {
    case 'pp.item':
      return value
    case 'pp.gamma':
      return `${PP_PARAM_LABELS.gamma} ${value}`
    case 'pp.colorMode':
      return `${PP_PARAM_LABELS.colorMode} ${value}`
    case 'cl.look':
      return LOOK_LABEL[value] ?? value
    case 'cl.adjust':
      return CL_PARAM_LABELS[value as ClParam] ?? value
    default:
      /* wb.auto / wb.preset: the value is already the menu's own name. */
      return value
  }
}

/** Where a key belongs on a camera page: the three groups the recipe pages use. */
export function capabilityGroup(key: CapabilityKey): 'pp' | 'cl' | 'wb' {
  if (key === 'picture-profile' || key.startsWith('pp.')) return 'pp'
  if (key === 'creative-look' || key.startsWith('cl.')) return 'cl'
  return 'wb'
}

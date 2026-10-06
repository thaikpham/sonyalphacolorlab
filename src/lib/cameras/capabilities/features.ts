/**
 * One body's confirmed colour settings, grouped the way a camera page lists
 * them. Pure: the page passes in `capabilitiesOf(camera)`.
 */

import { WB_KELVIN_MENU } from '@/lib/camera/constants'
import type { ConfirmedClaim } from './checks'
import type { ModeScope, ShootingMode } from './evidence'
import { CAPABILITY_KEYS, capabilityGroup, capabilityLabel, type CapabilityKey } from './keys'

export type FeatureRow =
  | 'menu'
  | 'items'
  | 'gamma'
  | 'colorMode'
  | 'look'
  | 'adjustments'
  | 'auto'
  | 'presets'
  | 'temperature'

export type FeatureGroup = {
  readonly group: 'pp' | 'cl' | 'wb'
  /** Supported in both modes, by row, in the evidence's order. */
  readonly rows: readonly { readonly row: FeatureRow; readonly labels: readonly string[] }[]
  /** Supported for stills, refused or unstated for movies. */
  readonly stillsOnly: readonly string[]
  /** Refused in every mode: absent from the body's list, or refused in words. */
  readonly notOnBody: readonly string[]
}

function rowOf(key: CapabilityKey): FeatureRow {
  if (key === 'picture-profile' || key === 'creative-look') return 'menu'
  if (key === 'wb.kelvin') return 'temperature'
  const kind = key.slice(0, key.indexOf(':'))
  switch (kind) {
    case 'pp.item':
      return 'items'
    case 'pp.gamma':
      return 'gamma'
    case 'pp.colorMode':
      return 'colorMode'
    case 'cl.look':
      return 'look'
    case 'cl.adjust':
      return 'adjustments'
    case 'wb.auto':
      return 'auto'
    default:
      return 'presets'
  }
}

/**
 * Looks and presets are listed by their own short names (`FL`, `Daylight`);
 * the long label (`capabilityLabel`) is for the stills-only row, where the
 * code alone would be cryptic.
 */
function shortLabel(key: CapabilityKey): string {
  if (key === 'wb.kelvin') return WB_KELVIN_MENU
  if (key.startsWith('cl.look:')) return key.slice('cl.look:'.length)
  if (key.startsWith('pp.gamma:')) return key.slice('pp.gamma:'.length)
  if (key.startsWith('pp.colorMode:')) return key.slice('pp.colorMode:'.length)
  return capabilityLabel(key)
}

/** A claim scoped to both modes counts for each. */
function covers(scope: ModeScope, mode: ShootingMode): boolean {
  return scope === 'both' || scope === mode
}

export function summariseFeatures(byKey: ReadonlyMap<CapabilityKey, readonly ConfirmedClaim[]>): FeatureGroup[] {
  const groups = new Map<FeatureGroup['group'], { rows: Map<FeatureRow, string[]>; stillsOnly: string[]; notOnBody: string[] }>()
  for (const g of ['pp', 'cl', 'wb'] as const) groups.set(g, { rows: new Map(), stillsOnly: [], notOnBody: [] })

  /* In `constants.ts` order, not the evidence's: an object keyed `709` lists it
     first, and a camera page should read like the menu. */
  const order = new Map(CAPABILITY_KEYS.map((k, i) => [k, i]))
  const keys = [...byKey.keys()].sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0))
  for (const key of keys) {
    const claims = byKey.get(key)!
    const g = groups.get(capabilityGroup(key))!
    const supported = (mode: ShootingMode) => claims.some((c) => c.status === 'supported' && covers(c.mode, mode))
    const refused = (mode: ShootingMode) => claims.some((c) => c.status === 'unsupported' && covers(c.mode, mode))
    if (supported('photo') && supported('video')) {
      const row = rowOf(key)
      g.rows.set(row, [...(g.rows.get(row) ?? []), shortLabel(key)])
    } else if (supported('photo')) {
      g.stillsOnly.push(capabilityLabel(key))
    } else if (refused('photo') && refused('video')) {
      g.notOnBody.push(shortLabel(key))
    }
  }

  return [...groups]
    .map(([group, g]) => ({
      group,
      rows: [...g.rows].filter(([row]) => row !== 'menu').map(([row, labels]) => ({ row, labels })),
      stillsOnly: g.stillsOnly,
      notOnBody: g.notOnBody,
    }))
    .filter((g) => g.rows.length > 0 || g.stillsOnly.length > 0)
}

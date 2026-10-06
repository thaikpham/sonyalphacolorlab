/**
 * A body's colour capabilities, as the camera page uses them: the evidence,
 * filtered by its checks, indexed once at module load.
 *
 * Static data — two files in the repository, no database and no network —
 * so it reads the same online and offline, and can never fail a page render.
 */

import checksJson from '../../../../data/camera-evidence.checks.json'
import { checksFileSchema, confirmedClaims, type ChecksFile, type ConfirmedClaim } from './checks'
import { EVIDENCE_SOURCES } from './evidence'
import type { CapabilityKey } from './keys'

export const EVIDENCE_CHECKS: ChecksFile = checksFileSchema.parse(checksJson)

const CAMERA_OF_SOURCE = new Map(EVIDENCE_SOURCES.map((s) => [s.id, s.camera]))

/** Confirmed claims, by body, then by capability. */
const CAPABILITY_INDEX: ReadonlyMap<string, ReadonlyMap<CapabilityKey, readonly ConfirmedClaim[]>> = (() => {
  const index = new Map<string, Map<CapabilityKey, ConfirmedClaim[]>>()
  for (const s of EVIDENCE_SOURCES) {
    for (const claim of confirmedClaims(s, EVIDENCE_CHECKS.sources[s.id])) {
      const camera = CAMERA_OF_SOURCE.get(claim.source.id) ?? ''
      const byKey = index.get(camera) ?? new Map<CapabilityKey, ConfirmedClaim[]>()
      byKey.set(claim.capability, [...(byKey.get(claim.capability) ?? []), claim])
      index.set(camera, byKey)
    }
  }
  return index
})()

/** Every confirmed claim for one body, by capability. Empty for a body with no evidence. */
export function capabilitiesOf(camera: string): ReadonlyMap<CapabilityKey, readonly ConfirmedClaim[]> {
  return CAPABILITY_INDEX.get(camera) ?? new Map()
}

/** The pages behind one body's claims, each once, with the day it was checked. */
export function sourcesOf(camera: string): readonly ConfirmedClaim['source'][] {
  const seen = new Map<string, ConfirmedClaim['source']>()
  for (const claims of capabilitiesOf(camera).values()) {
    for (const c of claims) seen.set(c.source.id, c.source)
  }
  return [...seen.values()]
}

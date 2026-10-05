/**
 * Camera compatibility, as the pages use it: the evidence, filtered by its
 * checks, indexed once at module load.
 *
 * Static data — two files in the repository, no database and no network —
 * so it reads the same online and offline, and a compatibility verdict can
 * never fail a page render.
 */

import checksJson from '../../../../data/camera-evidence.checks.json'
import { checksFileSchema, confirmedClaims, type ChecksFile, type ConfirmedClaim } from './checks'
import { assess, buildIndex, type Assessment, type CapabilityIndex } from './engine'
import { EVIDENCE_SOURCES, type ShootingMode } from './evidence'
import { requirementsFor, type CapabilityKey, type RecipeSettings } from './keys'

export const EVIDENCE_CHECKS: ChecksFile = checksFileSchema.parse(checksJson)

const CAMERA_OF_SOURCE = new Map(EVIDENCE_SOURCES.map((s) => [s.id, s.camera]))

export const CONFIRMED_CLAIMS: readonly ConfirmedClaim[] = EVIDENCE_SOURCES.flatMap((s) =>
  confirmedClaims(s, EVIDENCE_CHECKS.sources[s.id]),
)

export const CAPABILITY_INDEX: CapabilityIndex = buildIndex(
  CONFIRMED_CLAIMS,
  (c) => CAMERA_OF_SOURCE.get(c.source.id) ?? '',
)

/** Bodies with at least one confirmed claim, in the evidence file's order. */
export const EVIDENCED_CAMERAS: readonly string[] = [
  ...new Set(EVIDENCE_SOURCES.map((s) => s.camera).filter((c) => CAPABILITY_INDEX.has(c))),
]

export const SHOOTING_MODES: readonly ShootingMode[] = ['photo', 'video']

export function assessRecipe(recipe: RecipeSettings, camera: string, mode: ShootingMode): Assessment {
  return assess(requirementsFor(recipe), camera, { mode }, CAPABILITY_INDEX)
}

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

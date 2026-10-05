/**
 * Recipe × body × mode → one of four verdicts, with the reason for each
 * requirement (brief §5.2).
 *
 * | Verdict        | Means                                                         |
 * |----------------|---------------------------------------------------------------|
 * | `verified`     | every requirement is confirmed supported for this body + mode |
 * | `partial`      | something is unsupported, and a confirmed alternative exists  |
 * | `incompatible` | something is confirmed unsupported, with no alternative       |
 * | `unknown`      | nothing refused, but something is not confirmed               |
 *
 * `incompatible` outranks `unknown`: one setting Sony says the body refuses is
 * enough to know the recipe cannot be reproduced there as written. `verified`
 * is about settings only — it promises nothing about how a different sensor
 * renders them.
 *
 * Nothing here reads a network, a database or the clock. The index is built
 * from the evidence file and the checks file at module load (`index.ts`).
 */

import type { ConfirmedClaim } from './checks'
import type { ModeScope, ShootingMode } from './evidence'
import type { CapabilityKey, Requirement } from './keys'

export type Verdict = 'verified' | 'partial' | 'incompatible' | 'unknown'

export type Outcome =
  | {
      readonly kind: 'supported'
      readonly requirement: Requirement
      /** Set when the claim names a minimum body software and the reader gave none. */
      readonly firmware?: string
      readonly evidence: readonly ConfirmedClaim[]
    }
  | {
      readonly kind: 'substituted'
      readonly requirement: Requirement
      readonly alternative: CapabilityKey
      readonly evidence: readonly ConfirmedClaim[]
    }
  | {
      readonly kind: 'unsupported'
      readonly requirement: Requirement
      readonly reason: 'stated' | 'absent' | 'outOfRange' | 'offStep' | 'firmware'
      readonly evidence: readonly ConfirmedClaim[]
    }
  | {
      readonly kind: 'unknown'
      readonly requirement: Requirement
      /** `noEvidence`: nothing confirmed. `modeUnstated`: confirmed for the other mode only.
          `rangeUnstated` / `stepUnstated`: present, but the page gives no numbers to test the value against. */
      readonly reason: 'noEvidence' | 'modeUnstated' | 'rangeUnstated' | 'stepUnstated'
    }

export type Assessment = {
  readonly camera: string
  readonly mode: ShootingMode
  readonly verdict: Verdict
  readonly outcomes: readonly Outcome[]
}

/** Confirmed claims, by body, then by capability. */
export type CapabilityIndex = ReadonlyMap<string, ReadonlyMap<CapabilityKey, readonly ConfirmedClaim[]>>

export function buildIndex(claims: readonly ConfirmedClaim[], cameraOf: (c: ConfirmedClaim) => string): CapabilityIndex {
  const index = new Map<string, Map<CapabilityKey, ConfirmedClaim[]>>()
  for (const claim of claims) {
    const camera = cameraOf(claim)
    const byKey = index.get(camera) ?? new Map<CapabilityKey, ConfirmedClaim[]>()
    byKey.set(claim.capability, [...(byKey.get(claim.capability) ?? []), claim])
    index.set(camera, byKey)
  }
  return index
}

export function covers(scope: ModeScope, mode: ShootingMode): boolean {
  return scope === 'both' || scope === mode
}

/** `2.00` vs `1.10` → positive. Sony writes body software as dotted numbers. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d !== 0) return d
  }
  return 0
}

const onStep = (value: number, min: number, step: number) =>
  Math.abs((value - min) / step - Math.round((value - min) / step)) < 1e-9

type Options = { readonly mode: ShootingMode; readonly firmware?: string }

function resolve(requirement: Requirement, claims: readonly ConfirmedClaim[], options: Options, index: ReadonlyMap<CapabilityKey, readonly ConfirmedClaim[]>, depth = 0): Outcome {
  const applicable = claims.filter((c) => covers(c.mode, options.mode))
  if (applicable.length === 0) {
    return { kind: 'unknown', requirement, reason: claims.length > 0 ? 'modeUnstated' : 'noEvidence' }
  }

  const refusals = applicable.filter((c) => c.status === 'unsupported')
  if (refusals.length > 0) {
    /* One level of substitution: an alternative is itself a plain capability,
       and a chain of stand-ins would be a recipe the reader never asked for. */
    if (depth === 0) {
      for (const refusal of refusals) {
        if (!refusal.alternative) continue
        const alt = resolve({ capability: refusal.alternative }, index.get(refusal.alternative) ?? [], options, index, 1)
        if (alt.kind === 'supported') {
          return { kind: 'substituted', requirement, alternative: refusal.alternative, evidence: [refusal, ...alt.evidence] }
        }
      }
    }
    return { kind: 'unsupported', requirement, reason: refusals.some((c) => !c.absentFrom) ? 'stated' : 'absent', evidence: refusals }
  }

  const supports = applicable.filter((c) => c.status === 'supported')

  if (requirement.values?.length) {
    const ranged = supports.find((c) => c.range)
    if (!ranged?.range) return { kind: 'unknown', requirement, reason: 'rangeUnstated' }
    const { min, max, step } = ranged.range
    if (requirement.values.some((v) => v < min || v > max)) {
      return { kind: 'unsupported', requirement, reason: 'outOfRange', evidence: [ranged] }
    }
    if (step === undefined) return { kind: 'unknown', requirement, reason: 'stepUnstated' }
    if (requirement.values.some((v) => !onStep(v, min, step))) {
      return { kind: 'unsupported', requirement, reason: 'offStep', evidence: [ranged] }
    }
  }

  /* The earliest software any confirming claim allows. No claim names one → none needed. */
  const gates = supports.map((c) => c.firmware)
  const firmware = gates.includes(undefined)
    ? undefined
    : (gates as string[]).reduce((a, b) => (compareVersions(a, b) <= 0 ? a : b))
  if (firmware && options.firmware) {
    if (compareVersions(options.firmware, firmware) < 0) {
      return { kind: 'unsupported', requirement, reason: 'firmware', evidence: supports }
    }
    return { kind: 'supported', requirement, evidence: supports }
  }
  return { kind: 'supported', requirement, ...(firmware ? { firmware } : {}), evidence: supports }
}

export function verdictOf(outcomes: readonly Outcome[]): Verdict {
  if (outcomes.some((o) => o.kind === 'unsupported')) return 'incompatible'
  if (outcomes.some((o) => o.kind === 'unknown')) return 'unknown'
  if (outcomes.some((o) => o.kind === 'substituted')) return 'partial'
  return 'verified'
}

export function assess(
  requirements: readonly Requirement[],
  camera: string,
  options: Options,
  index: CapabilityIndex,
): Assessment {
  const byKey = index.get(camera) ?? new Map<CapabilityKey, readonly ConfirmedClaim[]>()
  const outcomes = requirements.map((r) => resolve(r, byKey.get(r.capability) ?? [], options, byKey))
  return { camera, mode: options.mode, verdict: verdictOf(outcomes), outcomes }
}

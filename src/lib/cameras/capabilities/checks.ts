/**
 * Which claims a live check of their page has confirmed.
 *
 * `data/camera-evidence.checks.json` is written by `npm run capabilities:check`
 * and by nothing else — like `data/*.seed.json`, never hand-edit it. For each
 * source it records the day the page was fetched, the topic heading found,
 * every literal found (with the sentence around it, so a reviewer can read
 * the evidence in the diff) and every literal missing.
 *
 * A claim is confirmed only when its source's check is for the same URL,
 * read the same topic, and found every literal the claim quotes *as the claim
 * quotes it now*. Edit a claim and it drops out until the next check — the
 * file cannot vouch for words it never looked for.
 */

import { z } from 'zod'
import type { Claim, EvidenceSource, ModeScope } from './evidence'
import { normalise } from './page-text'

const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

const sourceCheckSchema = z.strictObject({
  url: z.string().url(),
  checkedAt: isoDay,
  /** `ok`: the page was fetched and its topic read. Anything else confirms nothing. */
  outcome: z.enum(['ok', 'unreadable', 'unreachable']),
  httpStatus: z.number().int().optional(),
  title: z.string().optional(),
  /** Normalised literal → the text around it on the page. */
  found: z.record(z.string(), z.string()),
  missing: z.array(z.string()),
  /** `absentKey(…)` → what the list held. */
  absent: z.record(z.string(), z.enum(['absent', 'present', 'no-list'])),
})

export const checksFileSchema = z.strictObject({
  version: z.literal(1),
  sources: z.record(z.string(), sourceCheckSchema),
})

export type SourceCheck = z.infer<typeof sourceCheckSchema>
export type ChecksFile = z.infer<typeof checksFileSchema>


/** The key an absence is recorded under: the option, and the list it was looked for in. */
export function absentKey(a: NonNullable<Claim['absentFrom']>): string {
  return `${normalise(a.literal)} ∉ ${normalise(a.after)} … ${normalise(a.before)}`
}

/** A claim as the camera page uses it: confirmed, with its mode resolved and its page attached. */
export type ConfirmedClaim = Claim & {
  readonly mode: ModeScope
  readonly source: {
    readonly id: string
    readonly url: string
    readonly topic: string
    readonly checkedAt: string
  }
}

export function confirmedClaims(source: EvidenceSource, check: SourceCheck | undefined): ConfirmedClaim[] {
  if (!check || check.outcome !== 'ok') return []
  if (check.url !== source.url || check.title !== normalise(source.topic)) return []
  const found = (literal: string) => Object.hasOwn(check.found, normalise(literal))
  return source.claims
    .filter(
      (claim) =>
        claim.match.every(found) &&
        (!claim.absentFrom || check.absent[absentKey(claim.absentFrom)] === 'absent'),
    )
    .map((claim) => ({
      ...claim,
      mode: claim.mode ?? source.scope,
      source: { id: source.id, url: source.url, topic: source.topic, checkedAt: check.checkedAt },
    }))
}

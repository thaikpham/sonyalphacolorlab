/**
 * Which claims a live check of their page has confirmed.
 *
 * `data/camera-evidence.checks.json` is written by `npm run capabilities:check`
 * (through `checkSource`) and by nothing else — like `data/*.seed.json`, never
 * hand-edit it. For each source it records the day the page was fetched, the
 * topic heading found, the body the guide names, every literal found (with
 * the sentence around it, so a reviewer can read the evidence in the diff)
 * and every literal missing.
 *
 * A claim is confirmed only when its source's check is for the same URL, read
 * the same topic in the guide of the camera the source names, and found every
 * literal the claim quotes *as the claim quotes it now*. Edit a claim and it
 * drops out until the next check — the file cannot vouch for words it never
 * looked for, nor lend one body's page to another.
 */

import { z } from 'zod'
import type { Claim, EvidenceSource, TopicScope } from './evidence'
import { findLiteral, helpGuideText, normalise, section } from './page-text'

const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

const sourceCheckSchema = z.strictObject({
  url: z.string().url(),
  checkedAt: isoDay,
  /** `ok`: the page was fetched and its topic read. Anything else confirms nothing. */
  outcome: z.enum(['ok', 'unreadable', 'unreachable']),
  httpStatus: z.number().int().optional(),
  title: z.string().optional(),
  /** The model code the guide's document title names: `ILCE-7M4`. */
  model: z.string().optional(),
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

/**
 * What one fetched page holds of its source's claims — the record
 * `npm run capabilities:check` writes. `html` is `undefined` when the page
 * could not be fetched. Here rather than in the script so the path from a
 * page to a confirmed claim is tested whole.
 */
export function checkSource(
  source: EvidenceSource,
  html: string | undefined,
  status?: number,
  checkedAt: string = new Date().toISOString().slice(0, 10),
): SourceCheck {
  const base = { url: source.url, checkedAt, found: {}, missing: [], absent: {} }
  if (html === undefined) return { ...base, outcome: 'unreachable', ...(status ? { httpStatus: status } : {}) }
  const page = helpGuideText(html)
  if (!page) return { ...base, outcome: 'unreadable', ...(status ? { httpStatus: status } : {}) }

  const found: Record<string, string> = {}
  const missing = new Set<string>()
  const absent: SourceCheck['absent'] = {}
  for (const claim of source.claims) {
    for (const literal of claim.match) {
      const key = normalise(literal)
      const hit = findLiteral(page.body, literal)
      if (hit) found[key] = hit.context
      else missing.add(key)
    }
    if (claim.absentFrom) {
      const list = section(page.body, claim.absentFrom.after, claim.absentFrom.before)
      absent[absentKey(claim.absentFrom)] =
        list === null ? 'no-list' : findLiteral(list, claim.absentFrom.literal) ? 'present' : 'absent'
    }
  }
  return {
    ...base,
    outcome: 'ok',
    ...(status ? { httpStatus: status } : {}),
    title: page.title,
    ...(page.model ? { model: page.model } : {}),
    found: Object.fromEntries(Object.entries(found).sort(([a], [b]) => a.localeCompare(b))),
    missing: [...missing].sort(),
    absent: Object.fromEntries(Object.entries(absent).sort(([a], [b]) => a.localeCompare(b))),
  }
}

/** A claim as the camera page uses it: confirmed, with its mode resolved and its page attached. */
export type ConfirmedClaim = Omit<Claim, 'mode'> & {
  readonly mode: TopicScope
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
  /* Topic ids repeat across guides: the right topic in another body's guide is still another body. */
  if (check.model !== source.camera) return []
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

import { describe, expect, it } from 'vitest'
import camerasSeed from '../../../../data/sony-cameras.seed.json'
import { modelCode } from '../aliases'
import { EVIDENCE_SOURCES, type Claim, type EvidenceSource } from './evidence'
import { EVIDENCE_CHECKS } from './index'
import { absentKey, confirmedClaims, type ConfirmedClaim, type SourceCheck } from './checks'
import { isCapabilityKey } from './keys'
import { normalise } from './page-text'

/**
 * The rules in `evidence.ts`'s header, held. The last block is the one that
 * matters most: committed evidence and the committed checks file must agree,
 * so a claim edited without re-checking its page fails here rather than
 * quietly disappearing from every camera page.
 */

const catalogueModels = new Set(
  (camerasSeed as { sku: string; category: string }[])
    .filter((c) => c.category === 'camera')
    .map((c) => modelCode(c.sku)),
)

describe('evidence sources', () => {
  it('have unique ids of the form <model>/<topic>', () => {
    const ids = EVIDENCE_SOURCES.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const s of EVIDENCE_SOURCES) expect(s.id.startsWith(`${s.camera}/`), s.id).toBe(true)
  })

  it('name bodies the catalogue holds', () => {
    for (const s of EVIDENCE_SOURCES) expect(catalogueModels.has(s.camera), s.camera).toBe(true)
  })

  it('cite Sony Help Guide pages only', () => {
    for (const s of EVIDENCE_SOURCES) expect(s.url).toMatch(/^https:\/\/helpguide\.sony\.net\//)
  })

  it('scope each topic by what its heading says', () => {
    for (const s of EVIDENCE_SOURCES) {
      const expected = s.topic.endsWith('(still image/movie)')
        ? 'both'
        : s.topic.endsWith('(movie)')
          ? 'video'
          : s.topic.endsWith('(still image)')
            ? 'photo'
            : null
      expect(expected, `${s.id}: a heading that states no scope cannot set one`).not.toBeNull()
      expect(s.scope, s.id).toBe(expected)
    }
  })
})

describe('claims', () => {
  const all = EVIDENCE_SOURCES.flatMap((s) => s.claims.map((c) => [s.id, c] as const))

  it('name real capability keys', () => {
    for (const [id, c] of all) expect(isCapabilityKey(c.capability), `${id} ${c.capability}`).toBe(true)
  })

  it('quote something, and only an unsupported claim may rest on an absence', () => {
    for (const [id, c] of all) {
      expect(c.match.length > 0 || c.absentFrom !== undefined, `${id} ${c.capability}`).toBe(true)
      if (c.absentFrom) expect(c.status, `${id} ${c.capability}`).toBe('unsupported')
      if (c.alternative) expect(c.status).toBe('unsupported')
    }
  })

  it('carry a range only where its numbers are quoted', () => {
    for (const [id, c] of all) {
      if (!c.range) continue
      const quoted = c.match.join(' ')
      for (const n of [c.range.min, c.range.max, c.range.step].filter((x) => x !== undefined)) {
        expect(quoted, `${id} ${c.capability}`).toContain(String(n))
      }
    }
  })

  it('a support with a known exception states its own mode, so a lost exception cannot widen it', () => {
    for (const s of EVIDENCE_SOURCES) {
      const refusedIn = new Map<string, Set<string>>()
      for (const c of s.claims) {
        if (c.status === 'unsupported' && c.mode) {
          refusedIn.set(c.capability, new Set([...(refusedIn.get(c.capability) ?? []), c.mode]))
        }
      }
      for (const c of s.claims) {
        const modes = refusedIn.get(c.capability)
        if (c.status !== 'supported' || !modes) continue
        expect(c.mode, `${s.id} ${c.capability}`).toBeDefined()
        expect(c.mode === 'both' || modes.has(c.mode!), `${s.id} ${c.capability}`).toBe(false)
      }
    }
  })
})

describe('the checks file', () => {
  it('records only sources the evidence holds', () => {
    const ids = new Set(EVIDENCE_SOURCES.map((s) => s.id))
    for (const id of Object.keys(EVIDENCE_CHECKS.sources)) expect(ids.has(id), id).toBe(true)
  })

  it.each(EVIDENCE_SOURCES.map((s) => [s.id, s] as const))(
    '%s: every claim is confirmed by the last check — re-run `npm run capabilities:check` after editing evidence',
    (_id, source) => {
      const check = EVIDENCE_CHECKS.sources[source.id]
      expect(check?.outcome).toBe('ok')
      expect(check?.title).toBe(normalise(source.topic))
      const confirmed = new Set(confirmedClaims(source, check))
      const unconfirmed = source.claims
        .filter((c) => ![...confirmed].some((k) => sameClaim(k, c)))
        .map((c) => `${c.capability} (${c.status}${c.absentFrom ? `, ${check?.absent[absentKey(c.absentFrom)]}` : ''})`)
      expect(unconfirmed).toEqual([])
    },
  )
})

/* A confirmed claim carries its resolved mode, so identity is everything else. */
function sameClaim(a: Claim, b: Claim): boolean {
  return (
    a.capability === b.capability &&
    a.status === b.status &&
    a.match.join('\n') === b.match.join('\n') &&
    a.absentFrom?.literal === b.absentFrom?.literal
  )
}

/* Fixtures for the confirmation rules. Bodies are named `TEST-*` so nothing
   here can be mistaken for a claim about a real camera. */

const source = (claims: Claim[], scope: EvidenceSource['scope'] = 'both'): EvidenceSource => ({
  id: 'TEST-1/topic',
  camera: 'TEST-1',
  url: 'https://helpguide.sony.net/fixture.html',
  topic: 'Topic (still image/movie)',
  scope,
  claims,
})

/** A check that found every literal and every absence the claims ask for. */
const passing = (s: EvidenceSource): SourceCheck => ({
  url: s.url,
  checkedAt: '2026-10-05',
  outcome: 'ok',
  title: s.topic,
  found: Object.fromEntries(s.claims.flatMap((c) => c.match).map((m) => [m, `…${m}…`])),
  missing: [],
  absent: Object.fromEntries(s.claims.filter((c) => c.absentFrom).map((c) => [absentKey(c.absentFrom!), 'absent'])),
})

describe('only confirmed claims count', () => {
  const claims: Claim[] = [{ capability: 'cl.look:FL', status: 'supported', match: ['FL(Film):'] }]
  const s = source(claims)

  it.each([
    ['no check', undefined],
    ['an unreachable page', { ...passing(s), outcome: 'unreachable' as const }],
    ['a check of another URL', { ...passing(s), url: 'https://helpguide.sony.net/other.html' }],
    ['a check that read another topic', { ...passing(s), title: 'Something Else (still image)' }],
    ['a literal the check did not find', { ...passing(s), found: {}, missing: ['FL(Film):'] }],
  ])('%s confirms nothing', (_label, check) => {
    expect(confirmedClaims(s, check)).toEqual([])
  })

  it('an absence counts only when the list itself was found', () => {
    const absence: Claim = {
      capability: 'pp.gamma:S-Log2',
      status: 'unsupported',
      match: [],
      absentFrom: { after: 'a', before: 'b', literal: 'S-Log2:' },
    }
    const t = source([absence])
    expect(confirmedClaims(t, { ...passing(t), absent: { [absentKey(absence.absentFrom!)]: 'no-list' } })).toEqual([])
    expect(confirmedClaims(t, { ...passing(t), absent: { [absentKey(absence.absentFrom!)]: 'present' } })).toEqual([])
    expect(confirmedClaims(t, passing(t))).toHaveLength(1)
  })

  it('carries the check date and resolves the mode from the topic', () => {
    const [c] = confirmedClaims(s, passing(s)) as ConfirmedClaim[]
    expect(c.mode).toBe('both')
    expect(c.source.checkedAt).toBe('2026-10-05')
  })
})

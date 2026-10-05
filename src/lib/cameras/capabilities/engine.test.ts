import { describe, expect, it } from 'vitest'
import { absentKey, confirmedClaims, type ConfirmedClaim, type SourceCheck } from './checks'
import { assess, buildIndex, compareVersions, verdictOf, type Outcome } from './engine'
import type { Claim, EvidenceSource } from './evidence'
import type { Requirement } from './keys'

/**
 * The engine against fixtures, one rule per case. Fixture bodies are named
 * `TEST-*` so nothing here can be mistaken for a claim about a real camera;
 * the real pilot is exercised against real recipes in `compatibility.test.ts`.
 */

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

function indexOf(claims: Claim[], scope?: EvidenceSource['scope']) {
  const s = source(claims, scope)
  return buildIndex(confirmedClaims(s, passing(s)), () => 'TEST-1')
}

const kinds = (outcomes: readonly Outcome[]) => outcomes.map((o) => o.kind)

const LOOK: Requirement = { capability: 'cl.look:FL' }
const MENU: Requirement = { capability: 'creative-look' }
const KELVIN = (k: number): Requirement => ({ capability: 'wb.kelvin', values: [k] })

describe('verdicts', () => {
  it('verified only when every requirement is confirmed for the mode', () => {
    const index = indexOf([
      { capability: 'creative-look', status: 'supported', match: ['menu'] },
      { capability: 'cl.look:FL', status: 'supported', match: ['FL(Film):'] },
    ])
    const a = assess([MENU, LOOK], 'TEST-1', { mode: 'photo' }, index)
    expect(a.verdict).toBe('verified')
    expect(kinds(a.outcomes)).toEqual(['supported', 'supported'])
  })

  it('unknown when one requirement has no evidence — never verified by default', () => {
    const index = indexOf([{ capability: 'creative-look', status: 'supported', match: ['menu'] }])
    const a = assess([MENU, LOOK], 'TEST-1', { mode: 'photo' }, index)
    expect(a.verdict).toBe('unknown')
    expect(a.outcomes[1]).toMatchObject({ kind: 'unknown', reason: 'noEvidence' })
  })

  it('unknown for a body with no evidence at all', () => {
    expect(assess([MENU], 'TEST-NONE', { mode: 'photo' }, indexOf([])).verdict).toBe('unknown')
  })

  it('incompatible outranks unknown', () => {
    const index = indexOf([{ capability: 'cl.look:FL', status: 'unsupported', match: ['FL is not available'] }])
    const a = assess([MENU, LOOK], 'TEST-1', { mode: 'photo' }, index)
    expect(a.verdict).toBe('incompatible')
    expect(a.outcomes[1]).toMatchObject({ kind: 'unsupported', reason: 'stated' })
  })

  it('partial when the refused setting has a confirmed stand-in, and says which', () => {
    const index = indexOf([
      { capability: 'creative-look', status: 'supported', match: ['menu'] },
      { capability: 'cl.look:FL', status: 'unsupported', match: ['use ST instead'], alternative: 'cl.look:ST' },
      { capability: 'cl.look:ST', status: 'supported', match: ['ST(Standard):'] },
    ])
    const a = assess([MENU, LOOK], 'TEST-1', { mode: 'photo' }, index)
    expect(a.verdict).toBe('partial')
    expect(a.outcomes[1]).toMatchObject({ kind: 'substituted', alternative: 'cl.look:ST' })
  })

  it('a stand-in that is not itself confirmed leaves the setting refused', () => {
    const index = indexOf([
      { capability: 'cl.look:FL', status: 'unsupported', match: ['use ST instead'], alternative: 'cl.look:ST' },
    ])
    expect(assess([LOOK], 'TEST-1', { mode: 'photo' }, index).verdict).toBe('incompatible')
  })

  it('an absence from a complete list is a refusal, and is reported as such', () => {
    const index = indexOf([
      {
        capability: 'pp.gamma:S-Log2',
        status: 'unsupported',
        match: [],
        absentFrom: { after: 'Gamma Selects', before: 'Black Gamma', literal: 'S-Log2:' },
      },
    ])
    const a = assess([{ capability: 'pp.gamma:S-Log2' }], 'TEST-1', { mode: 'photo' }, index)
    expect(a.outcomes[0]).toMatchObject({ kind: 'unsupported', reason: 'absent' })
  })

  it('verdictOf ranks the outcomes', () => {
    const r: Requirement = { capability: 'creative-look' }
    expect(verdictOf([])).toBe('verified')
    expect(verdictOf([{ kind: 'unknown', requirement: r, reason: 'noEvidence' }])).toBe('unknown')
  })
})

describe('shooting mode', () => {
  it('a topic scoped to stills and movies covers both', () => {
    const index = indexOf([{ capability: 'cl.look:FL', status: 'supported', match: ['FL(Film):'] }])
    expect(assess([LOOK], 'TEST-1', { mode: 'video' }, index).verdict).toBe('verified')
  })

  it('support stated for stills is unknown in movies, not supported', () => {
    const index = indexOf([
      { capability: 'cl.adjust:sharpnessRange', status: 'supported', mode: 'photo', match: ['Sharpness Range:'] },
    ])
    const a = assess([{ capability: 'cl.adjust:sharpnessRange' }], 'TEST-1', { mode: 'video' }, index)
    expect(a.outcomes[0]).toMatchObject({ kind: 'unknown', reason: 'modeUnstated' })
  })

  it('a movie-mode refusal leaves stills supported', () => {
    const index = indexOf([
      { capability: 'cl.adjust:sharpnessRange', status: 'supported', mode: 'photo', match: ['Sharpness Range:'] },
      { capability: 'cl.adjust:sharpnessRange', status: 'unsupported', mode: 'video', match: ['cannot be adjusted'] },
    ])
    const req = [{ capability: 'cl.adjust:sharpnessRange' } as const]
    expect(assess(req, 'TEST-1', { mode: 'photo' }, index).verdict).toBe('verified')
    expect(assess(req, 'TEST-1', { mode: 'video' }, index).verdict).toBe('incompatible')
  })
})

describe('values', () => {
  it('a value with no range on the page is unknown', () => {
    const index = indexOf([{ capability: 'wb.kelvin', status: 'supported', match: ['C.Temp./Filter:'] }])
    expect(assess([KELVIN(5600)], 'TEST-1', { mode: 'photo' }, index).outcomes[0]).toMatchObject({
      kind: 'unknown',
      reason: 'rangeUnstated',
    })
  })

  it('a range without a step proves the bounds, not the value', () => {
    const index = indexOf([
      { capability: 'wb.kelvin', status: 'supported', match: ['2500K to 9900K'], range: { min: 2500, max: 9900 } },
    ])
    expect(assess([KELVIN(12000)], 'TEST-1', { mode: 'photo' }, index).outcomes[0]).toMatchObject({
      kind: 'unsupported',
      reason: 'outOfRange',
    })
    expect(assess([KELVIN(5600)], 'TEST-1', { mode: 'photo' }, index).outcomes[0]).toMatchObject({
      kind: 'unknown',
      reason: 'stepUnstated',
    })
  })

  it('a full range checks bounds and step', () => {
    const index = indexOf([
      { capability: 'wb.kelvin', status: 'supported', match: ['2500K to 9900K in 100K steps'], range: { min: 2500, max: 9900, step: 100 } },
    ])
    expect(assess([KELVIN(5600)], 'TEST-1', { mode: 'photo' }, index).verdict).toBe('verified')
    expect(assess([KELVIN(5650)], 'TEST-1', { mode: 'photo' }, index).outcomes[0]).toMatchObject({
      kind: 'unsupported',
      reason: 'offStep',
    })
  })
})

describe('body software', () => {
  const index = indexOf([{ capability: 'cl.look:FL', status: 'supported', match: ['FL(Film):'], firmware: '2.00' }])

  it('names the version as a condition when the reader gave none', () => {
    const a = assess([LOOK], 'TEST-1', { mode: 'photo' }, index)
    expect(a.verdict).toBe('verified')
    expect(a.outcomes[0]).toMatchObject({ kind: 'supported', firmware: '2.00' })
  })

  it('refuses an older body, accepts the same or newer', () => {
    expect(assess([LOOK], 'TEST-1', { mode: 'photo', firmware: '1.10' }, index).outcomes[0]).toMatchObject({
      kind: 'unsupported',
      reason: 'firmware',
    })
    const ok = assess([LOOK], 'TEST-1', { mode: 'photo', firmware: '2.00' }, index).outcomes[0]
    expect(ok.kind).toBe('supported')
    expect(ok).not.toHaveProperty('firmware')
  })

  it('compares dotted versions numerically', () => {
    expect(compareVersions('2.10', '2.9')).toBeGreaterThan(0)
    expect(compareVersions('1.00', '1')).toBe(0)
  })
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

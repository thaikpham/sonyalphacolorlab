import { describe, expect, it } from 'vitest'
import { ARTICLES } from '../src/lib/lab/articles'
import { PILOT_DRAFTS } from '../src/lib/lab/pilot-drafts'
import { labCandidates } from './lib/lab-candidates'

describe('labCandidates', () => {
  it('is exactly what push:lab inserted before packs existed', () => {
    expect(labCandidates({ withPilotDrafts: false })).toEqual(ARTICLES.map((article) => ({ article, status: 'published' })))
    expect(labCandidates({ withPilotDrafts: true })).toEqual([
      ...ARTICLES.map((article) => ({ article, status: 'published' })),
      ...PILOT_DRAFTS.map((article) => ({ article, status: 'draft' })),
    ])
  })

  it('adds a pack as drafts, never as published', () => {
    const page = { ...ARTICLES[0], id: 'probe-page' }
    const got = labCandidates({ withPilotDrafts: false, pack: 'probe' }, { probe: [page] })
    expect(got.at(-1)).toEqual({ article: page, status: 'draft' })
  })

  it('refuses a pack that does not exist, naming the ones that do', () => {
    expect(() => labCandidates({ withPilotDrafts: false, pack: 'nope' }, { one: [], two: [] })).toThrow(
      /Unknown pack "nope"\. Packs: one, two/,
    )
  })
})

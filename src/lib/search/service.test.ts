import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EMPTY_META } from '@/lib/lab/meta'
import type { Article } from '@/lib/lab/types'
import { searchRequestSchema } from './types'

/**
 * The service's promises, exercised with the data layer replaced:
 *
 * - search shows exactly what the published reads return, so unpublishing an
 *   article removes it on the next request (brief §7.3, §14.3);
 * - a source that fails is reported as unavailable and contributes nothing —
 *   never a seed, never an empty group passing as "no matches";
 * - the request is validated before anything is read.
 */

const state = vi.hoisted(() => ({
  articles: [] as Article[],
  failArticles: false,
  failProducts: false,
}))

vi.mock('@/lib/lab/data', () => ({
  getPublishedArticles: async () => {
    if (state.failArticles) throw new Error('content plane 502')
    return state.articles.filter((a) => a.kind === 'article')
  },
  getPublishedKnowledge: async () => state.articles.filter((a) => a.kind === 'knowledge'),
}))
vi.mock('@/lib/recipes/source', () => ({ listRecipes: async () => [] }))
vi.mock('@/lib/cameras/data', () => ({
  getSonyCameras: async () => {
    if (state.failProducts) throw new Error('content plane 402')
    return []
  },
}))
vi.mock('@/lib/audio/data', () => ({ getSonyAudio: async () => [] }))

const { searchContent } = await import('./service')

const article = (id: string, title: string): Article => ({
  id,
  kind: 'article',
  topic: 'exposure',
  level: 'newbie',
  archetype: 'explainer',
  read: '',
  title,
  dek: '',
  blocks: [{ t: 'p', text: 'Thân bài.' }],
  meta: EMPTY_META,
})

const search = (q: string, scope: 'all' | 'articles' = 'all') =>
  searchContent(searchRequestSchema.parse({ q, scope, locale: 'vi' }))

beforeEach(() => {
  state.articles = [article('iso-auto-min-ss', 'ISO Auto và Min. SS')]
  state.failArticles = false
  state.failProducts = false
})

describe('searchContent', () => {
  it('finds a published article', async () => {
    const res = await search('ISO Auto')
    expect(res.hits.map((h) => h.id)).toContain('iso-auto-min-ss')
    expect(res.unavailable).toEqual([])
  })

  it('drops an article the moment the published read stops returning it', async () => {
    /* No index of its own, so nothing to wait for: the next request after
       unpublish — whose write route has already invalidated the read's tag —
       no longer sees it. */
    expect((await search('ISO Auto')).hits.map((h) => h.id)).toContain('iso-auto-min-ss')
    state.articles = []
    expect((await search('ISO Auto')).hits.map((h) => h.id)).not.toContain('iso-auto-min-ss')
  })

  it('reports a failed source instead of passing it off as "no matches"', async () => {
    state.failArticles = true
    const res = await search('ISO Auto')
    expect(res.unavailable).toEqual(['article'])
    expect(res.hits.some((h) => h.kind === 'article')).toBe(false)
    /* No count for a kind that was not searched — "0" would be a claim. */
    expect(res.counts.article).toBeUndefined()
  })

  it('keeps answering from the sources that are up', async () => {
    state.failProducts = true
    const res = await search('Color Depth R')
    expect(res.unavailable).toEqual(['product'])
    expect(res.hits[0]).toMatchObject({ id: 'glossary-pp-colorDepth-R', kind: 'knowledge' })
  })

  it('reads only the kinds the scope names', async () => {
    state.failProducts = true
    const res = await search('ISO Auto', 'articles')
    expect(res.unavailable).toEqual([])
    expect(res.hits.every((h) => h.kind === 'article')).toBe(true)
  })

  it('returns reasons, never a score', async () => {
    const [hit] = (await search('ISO Auto')).hits
    expect(hit.reasonCodes.length).toBeGreaterThan(0)
    expect(hit).not.toHaveProperty('score')
  })
})

describe('searchRequestSchema', () => {
  it('trims and bounds the query', () => {
    const parsed = searchRequestSchema.parse({ q: `  ${'a'.repeat(200)}  ` })
    expect(parsed.q).toHaveLength(64)
    expect(parsed).toMatchObject({ locale: 'en', scope: 'all', limit: 10 })
  })

  it.each([
    ['an empty query', { q: '   ' }],
    ['an unknown scope', { q: 'x', scope: 'everything' }],
    ['an unknown locale', { q: 'x', locale: 'fr' }],
    ['a limit over twenty', { q: 'x', limit: '500' }],
    ['a cursor that is not an offset', { q: 'x', cursor: 'abc' }],
    ['a cursor past the bound', { q: 'x', cursor: '999' }],
  ])('refuses %s', (_label, input) => {
    expect(searchRequestSchema.safeParse(input).success).toBe(false)
  })
})

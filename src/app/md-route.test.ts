import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ARTICLES } from '@/lib/lab/articles'

const published = ARTICLES[0]
vi.mock('@/lib/lab/data', () => ({
  getPublishedArticle: vi.fn(async (id: string) => (id === published.id ? published : undefined)),
  getPublishedKnowledgePage: vi.fn(async () => undefined),
}))

const call = async (kind: string, id: string) => {
  const { GET } = await import('./md/[kind]/[id]/route')
  return GET(new Request(`https://site.test/md/${kind}/${id}`), { params: Promise.resolve({ kind, id }) })
}

describe('the .md twin', () => {
  beforeEach(() => vi.resetModules())

  it('answers a published article as Markdown', async () => {
    const res = await call('article', published.id)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('text/markdown; charset=utf-8')
    expect(await res.text()).toMatch(new RegExp(`^# ${published.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`))
  })

  it('is a 404 for an unknown id, a draft (not returned by the published reader) and an unknown kind', async () => {
    expect((await call('article', 'khong-co')).status).toBe(404)
    expect((await call('knowledge', published.id)).status).toBe(404)
    expect((await call('recipe', published.id)).status).toBe(404)
  })

  it('is reached from the canonical URL plus .md', () => {
    const config = readFileSync('next.config.ts', 'utf8')
    expect(config).toContain("source: '/vi/blog/:id([a-z0-9-]+)\\\\.md'")
    expect(config).toContain("destination: '/md/article/:id'")
    expect(config).toContain("source: '/vi/learn/:id([a-z0-9-]+)\\\\.md'")
    expect(config).toContain("destination: '/md/knowledge/:id'")
  })

  it('is announced by both article pages', () => {
    for (const p of ['src/app/[locale]/blog/[id]/page.tsx', 'src/app/[locale]/learn/[id]/page.tsx']) {
      expect(readFileSync(p, 'utf8')).toMatch(/types:\s*\{\s*'text\/markdown':/)
    }
  })
})

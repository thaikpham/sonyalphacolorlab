import { describe, expect, it } from 'vitest'
import { ARTICLES } from './articles'
import type { Article } from './types'
import { articleJsonLd, faqPairs } from './jsonld'

const base: Article = {
  ...ARTICLES[0],
  meta: {
    ...ARTICLES[0].meta,
    concepts: ['pp.colorDepth'],
    sources: [{ url: 'https://helpguide.sony.net/x', title: 'Color Depth', publisher: 'Sony', checkedAt: '2026-10-29' }],
  },
}
const opts = { site: 'https://site.test', path: `/vi/blog/${base.id}`, learnTitle: 'Kiến thức' }
const nodes = (a: Article) => articleJsonLd(a, opts)
const main = (a: Article) => nodes(a)[0] as Record<string, unknown>

describe('articleJsonLd', () => {
  it('keeps what it had: type, headline, url, language, breadcrumb', () => {
    const m = main(base)
    expect(m['@type']).toBe('BlogPosting')
    expect(m.headline).toBe(base.title)
    expect(m.url).toBe(`https://site.test/vi/blog/${base.id}`)
    expect(m.inLanguage).toBe('vi')
    expect(nodes(base).some((n) => n['@type'] === 'BreadcrumbList')).toBe(true)
  })

  it('names the publisher', () => {
    expect(main(base).publisher).toEqual({
      '@type': 'Organization',
      name: 'Alpha ColorLab',
      url: 'https://site.test',
      logo: 'https://site.test/icon',
    })
  })

  it('turns concepts into keywords and glossary DefinedTerms', () => {
    const m = main(base)
    expect(m.keywords).toBe('Picture Profile · Color Depth')
    expect(m.about).toEqual([
      expect.objectContaining({
        '@type': 'DefinedTerm',
        name: 'Picture Profile · Color Depth',
        inDefinedTermSet: 'https://site.test/vi/learn/glossary',
      }),
    ])
    expect((m.about as { url: string }[])[0].url).toMatch(/^https:\/\/site\.test\/vi\/learn\/glossary#.+/)
  })

  it('counts the words a reader sees', () => {
    expect(main(base).wordCount).toBeGreaterThan(50)
  })

  it('carries each source’s publisher in the citation', () => {
    expect(main(base).citation).toEqual([
      { '@type': 'CreativeWork', name: 'Color Depth', url: 'https://helpguide.sony.net/x', publisher: { '@type': 'Organization', name: 'Sony' } },
    ])
  })

  it('adds a FAQPage only for question headings answered by a paragraph', () => {
    expect(nodes(base).some((n) => n['@type'] === 'FAQPage')).toBe(false)
    const faq: Article = {
      ...base,
      blocks: [...base.blocks.slice(0, -1), { t: 'h', text: 'Color Depth là gì? ' }, { t: 'p', text: 'Là độ đậm màu.' }, base.blocks[base.blocks.length - 1]],
    }
    const page = nodes(faq).find((n) => n['@type'] === 'FAQPage') as { mainEntity: unknown[] }
    expect(page.mainEntity).toEqual([
      { '@type': 'Question', name: 'Color Depth là gì?', acceptedAnswer: { '@type': 'Answer', text: 'Là độ đậm màu.' } },
    ])
  })
})

describe('faqPairs', () => {
  it('needs the question mark and the paragraph right after it', () => {
    expect(faqPairs([{ t: 'h', text: 'Không hỏi' }, { t: 'p', text: 'x' }])).toEqual([])
    expect(faqPairs([{ t: 'h', text: 'Hỏi?' }, { t: 'table', head: ['a', 'b', 'c'], rows: [], caption: '' }])).toEqual([])
  })
})

import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SonyCamera } from '@/lib/cameras/types'
import { EMPTY_META } from '@/lib/lab/meta'
import type { Article } from '@/lib/lab/types'
import type { RecipeView } from '@/lib/recipes/source'
import { glossaryDocs, snippetFor } from './documents'
import { searchRequestSchema } from './request'
import {
  emptyState,
  MAX_OFFSET,
  type SearchHit,
  type SearchKind,
  type SearchScope,
} from './types'

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
  recipes: [] as unknown[],
  cameras: [] as unknown[],
  failArticles: false,
  failProducts: false,
}))

/* The real catalogues, so a label asserted here is the label a reader gets. */
vi.mock('next-intl/server', () => ({
  getTranslations: async ({ locale, namespace }: { locale: string; namespace: string }) => {
    const messages = JSON.parse(readFileSync(`messages/${locale}.json`, 'utf8'))
    return (key: string) =>
      key.split('.').reduce((node, k) => node?.[k], messages[namespace]) ?? `${namespace}.${key}`
  },
}))
vi.mock('@/lib/lab/data', () => ({
  getPublishedArticles: async () => {
    if (state.failArticles) throw new Error('content plane 502')
    return state.articles.filter((a) => a.kind === 'article')
  },
  getPublishedKnowledge: async () => state.articles.filter((a) => a.kind === 'knowledge'),
}))
vi.mock('@/lib/recipes/source', () => ({ listRecipes: async () => state.recipes }))
vi.mock('@/lib/cameras/data', () => ({
  getSonyCameras: async () => {
    if (state.failProducts) throw new Error('content plane 402')
    return state.cameras
  },
}))
vi.mock('@/lib/audio/data', () => ({ getSonyAudio: async () => [] }))

const { searchContent, searchGroups } = await import('./service')

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

const product = (over: Partial<SonyCamera> & { id: string; name: string }): SonyCamera =>
  ({
    sku: '',
    fullName: over.name,
    category: 'audio',
    subCategory1: 'Tai nghe',
    subCategory2: 'Choàng đầu',
    priceVnd: 8_990_000,
    priceFormatted: '8.990.000 ₫',
    imageUrl: '',
    features: { en: [], vi: [] },
    ...over,
  }) as SonyCamera

const recipe = (over: Partial<RecipeView>): RecipeView =>
  ({
    id: 'PP-001',
    slug: 'pp-001',
    name: 'PP-001-Neutral Soft Rich',
    format: 'pp',
    wbLabel: '5600K',
    description: '',
    tags: [],
    ...over,
  }) as RecipeView

const search = (q: string, scope: 'all' | 'articles' = 'all') =>
  searchContent(searchRequestSchema.parse({ q, scope, locale: 'vi' }))

const searchIn = (q: string, locale: 'en' | 'vi', scope: 'products' | 'recipes') =>
  searchContent(searchRequestSchema.parse({ q, scope, locale }))

beforeEach(() => {
  state.articles = [article('iso-auto-min-ss', 'ISO Auto và Min. SS')]
  state.recipes = []
  state.cameras = []
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

describe('a product hit', () => {
  beforeEach(() => {
    state.cameras = [
      product({ id: 'sony-wh-1000xm5', name: 'WH-1000XM5' }),
      product({
        id: 'sony-selc1635g',
        sku: 'SELC1635G/C SYX',
        name: 'FE C 16-35mm F4 G',
        category: 'lens',
        subCategory1: 'Full Frame',
        subCategory2: 'G',
        priceVnd: 0,
        priceFormatted: 'Liên hệ',
        features: {
          en: ['Constant F4 aperture', 'Power zoom'],
          vi: ['Khẩu độ F4 cố định', 'Zoom điện'],
        },
      }),
    ]
  })

  it("shows its stored sub-category and price in the reader's language", async () => {
    /* The seed stores "Tai nghe" and, for a product with no published
       figure, the Vietnamese "Liên hệ" — which read as the price on /en. */
    const [wh] = (await searchIn('WH-1000', 'en', 'products')).hits
    expect(wh).toMatchObject({ badge: 'Headphones', subtitle: 'Headphones · Over-ear' })
    const [lens] = (await searchIn('selc1635g', 'en', 'products')).hits
    expect(lens.price).toBe('Price on request')
    expect(lens.subtitle).toBe('SELC1635G · Full-Frame · G')

    const [whVi] = (await searchIn('WH-1000', 'vi', 'products')).hits
    expect(whVi).toMatchObject({ badge: 'Tai nghe', subtitle: 'Tai nghe · Choàng đầu' })
    expect((await searchIn('selc1635g', 'vi', 'products')).hits[0].price).toBe('Liên hệ')
  })

  it("takes its snippet from the reader's bullets, and says which language they are", async () => {
    const [vi] = (await searchIn('selc1635g', 'vi', 'products')).hits
    expect(vi.snippet).toBe('Khẩu độ F4 cố định · Zoom điện')
    expect(vi.snippetLanguage).toBe('vi')
    const [en] = (await searchIn('selc1635g', 'en', 'products')).hits
    expect(en.snippet).toBe('Constant F4 aperture · Power zoom')
    expect(en.snippetLanguage).toBe('en')
  })

  it('still finds a product by a bullet in the other language', async () => {
    const res = await searchIn('zoom điện', 'en', 'products')
    expect(res.hits.map((h) => h.id)).toContain('sony-selc1635g')
  })

  it('falls back to the English bullets, tagged English, when there are no Vietnamese ones', async () => {
    state.cameras = [
      product({ id: 'x', name: 'WH-1000XM5', features: { en: ['Noise cancelling'], vi: [] } }),
    ]
    const [hit] = (await searchIn('WH-1000', 'vi', 'products')).hits
    expect(hit).toMatchObject({ snippet: 'Noise cancelling', snippetLanguage: 'en' })
  })
})

describe('a recipe hit', () => {
  it('tags its snippet with the language the description was read in', async () => {
    /* The name is never translated, so the title stays English; the
       description is the locale's. */
    state.recipes = [recipe({ description: 'Tông ấm của sa mạc lúc hoàng hôn.' })]
    const [hit] = (await searchIn('soft rich', 'vi', 'recipes')).hits
    expect(hit).toMatchObject({ contentLanguage: 'en', snippetLanguage: 'vi' })
    expect(hit.snippet).toBe('Tông ấm của sa mạc lúc hoàng hôn.')
  })
})

describe('a glossary group hit', () => {
  it('does not print its first sentence twice', () => {
    /* A group's snippet opens with its overview, so a subtitle cut from the
       same overview repeated it on the line above. */
    for (const locale of ['en', 'vi'] as const) {
      const groups = glossaryDocs(locale).filter((d) => d.url.startsWith('/learn/glossary#') && d.tags.length > 1)
      expect(groups.map((d) => d.id)).toContain('glossary-wb')
      for (const doc of groups) {
        const { subtitle } = doc.display
        if (subtitle) expect(snippetFor(doc)?.startsWith(subtitle) ?? false, `${locale} ${doc.id}`).toBe(false)
      }
    }
  })
})

describe('searchGroups', () => {
  it('heads every group from the whole ranking, however many hits rank above it', async () => {
    /* "All" used to take the first 200 ranked hits and group those, so a
       kind ranked below 200 product titles showed a count and no rows. */
    state.cameras = Array.from({ length: MAX_OFFSET + 10 }, (_, i) =>
      product({ id: `p${i}`, name: `Zorblat ${i}` }),
    )
    state.articles = [1, 2, 3].map((i) => ({
      ...article(`k${i}`, `Page ${i}`),
      kind: 'knowledge' as const,
      blocks: [{ t: 'p' as const, text: 'Một đoạn về zorblat.' }],
    }))
    const res = await searchGroups({ q: 'zorblat', locale: 'en', scope: 'all' }, 6)
    expect(res.counts).toMatchObject({ product: MAX_OFFSET + 10, knowledge: 3 })
    expect(res.hits.filter((h) => h.kind === 'knowledge').map((h) => h.id).sort()).toEqual(['k1', 'k2', 'k3'])
    expect(res.hits.filter((h) => h.kind === 'product')).toHaveLength(6)
    expect(res.nextCursor).toBeNull()
  })
})

describe('the cursor', () => {
  it('pages as far as the schema accepts, and no further', async () => {
    state.cameras = Array.from({ length: MAX_OFFSET + 40 }, (_, i) =>
      product({ id: `p${i}`, name: `Zorblat ${i}` }),
    )
    let cursor: string | undefined
    let last: string | undefined
    for (;;) {
      const res = await searchContent(
        searchRequestSchema.parse({ q: 'zorblat', scope: 'products', limit: 20, cursor }),
      )
      if (!res.nextCursor) break
      expect(searchRequestSchema.safeParse({ q: 'x', cursor: res.nextCursor }).success).toBe(true)
      last = cursor = res.nextCursor
    }
    expect(last).toBe(String(MAX_OFFSET))
  })

  it('is bounded by the constant the schema uses, not a copy of it', () => {
    const service = readFileSync('src/lib/search/service.ts', 'utf8')
    expect(service).toMatch(/next <= MAX_OFFSET/)
    expect(service).not.toMatch(/\b200\b/)
  })
})

describe('emptyState', () => {
  const res = (scope: SearchScope, unavailable: SearchKind[], hits = 0) => ({
    scope,
    unavailable,
    hits: Array.from({ length: hits }, () => ({}) as SearchHit),
  })

  it('says nothing matched only when everything was searched', () => {
    expect(emptyState(res('recipes', []))).toBe('noResults')
    expect(emptyState(res('all', []))).toBe('noResults')
  })

  it('says nothing about matches when nothing could be searched', () => {
    /* /search?q=mojave&scope=recipes with the recipe read down: the status
       line names the failure, and "No results" would claim a search ran. */
    expect(emptyState(res('recipes', ['recipe']))).toBe('unsearched')
    expect(emptyState(res('all', ['recipe', 'product', 'article', 'knowledge']))).toBe('unsearched')
  })

  it('qualifies "no results" when only some kinds could be searched', () => {
    expect(emptyState(res('all', ['product']))).toBe('noResultsSearched')
  })

  it('is not a state at all when there are hits', () => {
    expect(emptyState(res('all', ['product'], 2))).toBeNull()
  })
})

describe('the /search page', () => {
  const page = readFileSync('src/app/[locale]/search/page.tsx', 'utf8')

  it('groups "All" from per-kind heads, not from a capped slice', () => {
    expect(page).toMatch(/searchGroups\(\{ q, locale, scope \}, PER_GROUP\)/)
    expect(page).not.toMatch(/limit: scope === 'all'/)
  })

  it('says "no results" only through emptyState', () => {
    expect(page).toMatch(/emptyState\(result\)/)
    expect(page).not.toMatch(/result\.hits\.length === 0/)
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

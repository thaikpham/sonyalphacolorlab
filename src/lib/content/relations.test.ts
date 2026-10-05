import { describe, expect, it } from 'vitest'
import { EMPTY_META } from '@/lib/lab/meta'
import type { Article, ArticleMeta } from '@/lib/lab/types'
import {
  buildUniverse,
  entriesReferencing,
  knowledgeExplaining,
  resolvePrerequisites,
  resolveRefs,
  unknownRefs,
} from './relations'

const page = (id: string, kind: Article['kind'], meta: Partial<ArticleMeta> = {}): Article => ({
  id,
  kind,
  topic: 'color',
  level: 'newbie',
  archetype: 'explainer',
  read: '',
  title: `Title ${id}`,
  dek: '',
  blocks: [],
  meta: { ...EMPTY_META, ...meta },
})

const recipes = [
  { id: 'SCL-PP-001', slug: 'mojave-sun', name: 'SCL-PP-001: Mojave Sun', format: 'pp' as const, wbLabel: '5600K, A2' },
  { id: 'SCL-CL-001', slug: 'film-look', name: 'SCL-CL-001: Film Look', format: 'cl' as const, wbLabel: 'AWB', look: 'FL' },
]
const products = [
  { id: 'sony-ilce-7m4-bq-ap2', name: '7 IV', sku: 'ILCE-7M4/BQ AP2', category: 'camera' },
  { id: 'sony-wh-1000xm6', name: 'WH-1000XM6', sku: '', category: 'audio' },
]

describe('resolveRefs', () => {
  const entries = [page('wb-shift', 'knowledge'), page('iso-auto-min-ss', 'article')]
  const universe = buildUniverse({ entries, recipes, products })

  it('renders each kind at its own route', () => {
    const links = resolveRefs(
      [
        { kind: 'recipe', id: 'SCL-PP-001' },
        { kind: 'recipe', id: 'SCL-CL-001' },
        { kind: 'product', id: 'sony-ilce-7m4-bq-ap2' },
        { kind: 'product', id: 'sony-wh-1000xm6' },
        { kind: 'knowledge', id: 'wb-shift' },
        { kind: 'article', id: 'iso-auto-min-ss' },
      ],
      universe,
    )
    expect(links.map((l) => l.href)).toEqual([
      '/recipe/mojave-sun',
      '/recipe/film-look',
      '/cameras/sony-ilce-7m4-bq-ap2',
      '/audio/sony-wh-1000xm6',
      '/learn/wb-shift',
      '/blog/iso-auto-min-ss',
    ])
    expect(links[0].subtitle).toBe('Picture Profile · 5600K, A2')
    expect(links[1].subtitle).toBe('Creative Look FL · AWB')
    expect(links[2].subtitle).toBe('ILCE-7M4')
    expect(links[3].subtitle).toBeUndefined()
  })

  it('renders nothing for a target that is not published or does not exist', () => {
    /* An unpublished page is simply absent from the published list the
       universe is built from — which is the whole mechanism by which an
       unpublish hides every link to it on the next request. */
    const links = resolveRefs(
      [
        { kind: 'article', id: 'unpublished-draft' },
        { kind: 'recipe', id: 'SCL-PP-099' },
        { kind: 'product', id: 'sony-not-a-product' },
      ],
      universe,
    )
    expect(links).toEqual([])
  })

  it('refuses a ref whose kind no longer matches the page', () => {
    /* Written when the page was an article; it is a knowledge page now, and
       an href built from the stale kind would 404. */
    expect(resolveRefs([{ kind: 'article', id: 'wb-shift' }], universe)).toEqual([])
  })

  it('keeps authored order and drops repeats', () => {
    const links = resolveRefs(
      [
        { kind: 'recipe', id: 'SCL-CL-001' },
        { kind: 'recipe', id: 'SCL-PP-001' },
        { kind: 'recipe', id: 'SCL-CL-001' },
      ],
      universe,
    )
    expect(links.map((l) => l.id)).toEqual(['SCL-CL-001', 'SCL-PP-001'])
  })

  it('resolves prerequisites of either page kind', () => {
    expect(resolvePrerequisites(['wb-shift', 'iso-auto-min-ss', 'gone'], universe).map((l) => l.kind)).toEqual([
      'knowledge',
      'article',
    ])
  })
})

describe('reverse links', () => {
  const a = page('a', 'article', { related: [{ kind: 'recipe', id: 'SCL-PP-001' }] })
  const b = page('b', 'knowledge', { related: [{ kind: 'product', id: 'sony-ilce-7m4-bq-ap2' }] })

  it('finds the pages that name a target', () => {
    expect(entriesReferencing({ kind: 'recipe', id: 'SCL-PP-001' }, [a, b])).toEqual([a])
    expect(entriesReferencing({ kind: 'product', id: 'sony-ilce-7m4-bq-ap2' }, [a, b])).toEqual([b])
    expect(entriesReferencing({ kind: 'recipe', id: 'SCL-PP-002' }, [a, b])).toEqual([])
  })

  it('orders knowledge pages by how much of the recipe they explain', () => {
    const one = page('one', 'knowledge', { concepts: ['pp.colorDepth'], order: 1 })
    const two = page('two', 'knowledge', { concepts: ['pp.colorDepth', 'wb.shiftAb'], order: 9 })
    const blog = page('blog', 'article', { concepts: ['pp.colorDepth', 'wb.shiftAb'] })
    const off = page('off', 'knowledge', { concepts: ['cl.fade'] })
    expect(
      knowledgeExplaining(['pp.colorDepth', 'wb.shiftAb'], [one, two, blog, off]).map((p) => p.id),
    ).toEqual(['two', 'one'])
  })
})

describe('unknownRefs', () => {
  const known = {
    recipes: new Set(['SCL-PP-001']),
    products: new Set(['sony-ilce-7m4-bq-ap2']),
    pages: new Map<string, 'article' | 'knowledge'>([
      ['draft-page', 'knowledge'],
      ['iso-auto-min-ss', 'article'],
    ]),
  }

  it('allows a link to a draft, and reports one to nothing', () => {
    expect(
      unknownRefs(
        {
          related: [
            { kind: 'recipe', id: 'SCL-PP-001' },
            { kind: 'knowledge', id: 'draft-page' },
            { kind: 'recipe', id: 'SCL-PP-404' },
            { kind: 'article', id: 'draft-page' },
          ],
          prerequisites: ['iso-auto-min-ss', 'missing'],
        },
        known,
      ),
    ).toEqual([
      { kind: 'recipe', id: 'SCL-PP-404' },
      { kind: 'article', id: 'draft-page' },
      { kind: 'article', id: 'missing' },
    ])
  })
})

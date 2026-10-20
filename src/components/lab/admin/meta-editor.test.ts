import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { CONCEPTS } from '@/lib/content/concepts'
import { ARTICLES } from '@/lib/lab/articles'
import { META_LIMITS, parseMeta } from '@/lib/lab/meta'
import { PILOT_DRAFTS } from '@/lib/lab/pilot-drafts'
import type { ArticleMeta } from '@/lib/lab/types'
import { MetaEditor, emptyMetaDraft, toMetaDraft, toMetaPayload, type MetaDraft } from './meta-editor'

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))

/**
 * The editor's metadata round trip, against the one validator.
 *
 * The header of `meta-editor.tsx` promises that the client sends what was
 * typed and `parseMeta()` alone decides what is kept. A regression on the
 * client side — `order` sent as a string, an id left untrimmed — would
 * surface only as `droppedMeta` on a live save, so it is executed here for
 * every page the repository ships.
 */

const roundTrip = (meta: ArticleMeta, kind: 'article' | 'knowledge') =>
  parseMeta(toMetaPayload(toMetaDraft(meta), kind))

describe('toMetaDraft → toMetaPayload → parseMeta', () => {
  it.each([...PILOT_DRAFTS, ...ARTICLES].map((a) => [a.id, a] as const))(
    'keeps %s exactly, dropping nothing',
    (_id, article) => {
      expect(roundTrip(article.meta, article.kind)).toEqual({ meta: article.meta, dropped: 0 })
    },
  )

  it('keeps a knowledge page’s section and order', () => {
    const meta: ArticleMeta = {
      ...PILOT_DRAFTS.find((a) => a.kind === 'knowledge')!.meta,
      section: 'sony-color',
      order: 3,
      authorName: 'Ban biên tập',
      reviewedAt: '2026-10-05',
    }
    expect(roundTrip(meta, 'knowledge')).toEqual({ meta, dropped: 0 })
  })

  it('sends no section or order for a blog article', () => {
    const draft = { ...emptyMetaDraft(), section: 'workflows', order: '2' }
    const payload = toMetaPayload(draft, 'article')
    expect(payload.section).toBe('')
    expect(payload.order).toBeNull()
    const { meta } = parseMeta(payload)
    expect(meta.section).toBeNull()
    expect(meta.order).toBeNull()
  })

  it('trims a related id and drops a wholly empty row before sending', () => {
    const draft = {
      ...emptyMetaDraft(),
      related: [
        { kind: 'knowledge' as const, id: '  white-balance-shift ' },
        { kind: 'recipe' as const, id: '   ' },
      ],
      sources: [{ url: '', title: '', publisher: '', section: '', checkedAt: '', scope: '' }],
    }
    const { meta, dropped } = parseMeta(toMetaPayload(draft, 'article'))
    expect(meta.related).toEqual([{ kind: 'knowledge', id: 'white-balance-shift' }])
    expect(meta.sources).toEqual([])
    expect(dropped).toBe(0)
  })

  it('sends a draft at every cap without a drop', () => {
    const draft = {
      ...emptyMetaDraft(),
      prerequisites: Array.from({ length: META_LIMITS.prerequisites }, (_, i) => `page-${i}`),
    }
    expect(parseMeta(toMetaPayload(draft, 'article')).dropped).toBe(0)
  })
})

describe('the editor stops at what parseMeta keeps', () => {
  /* Past a cap the server keeps the first N and counts the rest as dropped:
     the seventeenth concept saved, was reported as an invalid link or
     source, and was unticked on the reload. The control refuses it instead. */
  const render = (meta: MetaDraft) =>
    renderToStaticMarkup(
      createElement(MetaEditor, {
        kind: 'knowledge',
        meta,
        onChange: () => {},
        refs: null,
        refsFailed: false,
        unknownRefs: [],
      }),
    )
  /** Every `<button>` tag whose text is `label`, as its opening tag. */
  const buttons = (html: string, label: string): string[] =>
    [...html.matchAll(/<button([^>]*)>([^<]*)<\/button>/g)].filter((m) => m[2] === label).map((m) => m[1])

  it('disables every unticked concept once the cap is reached, and none before', () => {
    const keys = CONCEPTS.map((c) => c.key)
    expect(keys.length).toBeGreaterThan(META_LIMITS.concepts)
    const tagsOf = (concepts: string[]) =>
      [...render({ ...emptyMetaDraft(), concepts }).matchAll(/<button([^>]*aria-pressed[^>]*)>/g)].map((m) => m[1])

    const full = tagsOf(keys.slice(0, META_LIMITS.concepts))
    expect(full.filter((a) => a.includes('aria-pressed="false"')).every((a) => a.includes('disabled=""'))).toBe(true)
    // A ticked one can still be unticked.
    expect(full.filter((a) => a.includes('aria-pressed="true"')).some((a) => a.includes('disabled=""'))).toBe(false)

    const below = tagsOf(keys.slice(0, META_LIMITS.concepts - 1))
    expect(below.some((a) => a.includes('disabled=""'))).toBe(false)
  })

  const blank: { [K in 'prerequisites' | 'related' | 'sources']: MetaDraft[K][number] } = {
    prerequisites: '',
    related: { kind: 'recipe', id: '' },
    sources: { url: '', title: '', publisher: '', section: '', checkedAt: '', scope: '' },
  }

  it.each([
    ['prerequisites', 'addPrerequisite', META_LIMITS.prerequisites],
    ['related', 'addRelated', META_LIMITS.related],
    ['sources', 'addSource', META_LIMITS.sources],
  ] as const)('stops adding %s at the cap', (field, label, cap) => {
    const at = (n: number): string[] =>
      buttons(render({ ...emptyMetaDraft(), [field]: Array.from({ length: n }, () => blank[field]) }), label)
    expect(at(cap - 1)[0]).not.toContain('disabled=""')
    expect(at(cap)[0]).toContain('disabled=""')
  })
})

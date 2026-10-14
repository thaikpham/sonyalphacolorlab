import { describe, expect, it } from 'vitest'
import { ARTICLES } from '@/lib/lab/articles'
import { META_LIMITS, parseMeta } from '@/lib/lab/meta'
import { PILOT_DRAFTS } from '@/lib/lab/pilot-drafts'
import type { ArticleMeta } from '@/lib/lab/types'
import { emptyMetaDraft, toMetaDraft, toMetaPayload } from './meta-editor'

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

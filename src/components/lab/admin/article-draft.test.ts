import { describe, expect, it } from 'vitest'
import type { Article, ArticleStatus, Block } from '@/lib/lab/types'
import { EMPTY_META } from '@/lib/lab/meta'
import {
  addBlock,
  afterSave,
  asDraft,
  blankDraft,
  edited,
  isDirty,
  leavesInPlace,
  publishProblems,
  savePayload,
  withAsset,
  type Draft,
} from './article-draft'

/**
 * The article editor's draft, executed.
 *
 * The suite has no DOM, so the component's rules live in pure functions and
 * are run here; `content-lifecycle.test.ts` pins that the component goes
 * through them. Every case below was a way the editor lost or misreported
 * work: an upload landing on a stale copy of its block, a save's answer
 * overwriting what was typed during the round trip, a blank draft reporting
 * itself ready to publish.
 */

const A = '3f2b9c41-6d5e-4a7b-9c10-2e8f4a6b1d33'
const B = '8a1c0e22-4b7d-4f19-ae03-91d6c5b7f402'

const stored = (blocks: Block[], extra: Partial<Article> = {}, status: ArticleStatus = 'draft') => ({
  id: 'body-ev-vs-flash-ev',
  kind: 'article' as const,
  topic: 'setup' as const,
  level: 'newbie' as const,
  archetype: 'explainer' as const,
  read: '',
  title: 'Body EV vs flash EV',
  dek: '',
  blocks,
  meta: EMPTY_META,
  ...extra,
  status,
  updatedAt: '2026-10-14T01:00:00.000001+00:00',
})

const compare: Block = { t: 'compare', beforeLabel: '1/30', afterLabel: '1/125', caption: '' }

describe('an upload lands on the block it was picked for, as it is now', () => {
  it('keeps both halves of a comparison whose uploads resolve one after the other', () => {
    const opened = asDraft(stored([compare]))
    const key = opened.blocks[0].key
    /* Both picked before either answered: each completion used to spread the
       block as it was at pick time, so the second wrote the first away. */
    let d: Draft | null = withAsset(opened, opened.session, key, 'beforeAssetId', A)
    d = withAsset(d, opened.session, key, 'afterAssetId', B)
    expect(d?.blocks[0].block).toMatchObject({ beforeAssetId: A, afterAssetId: B })
  })

  it('keeps a caption typed while the upload was running', () => {
    const opened = asDraft(stored([{ t: 'figure', caption: '', alt: '' }]))
    const key = opened.blocks[0].key
    const typed = edited(opened, {
      blocks: opened.blocks.map((b) => ({ ...b, block: { ...b.block, caption: 'Flash EV' } as Block })),
    })
    const d = withAsset(typed, opened.session, key, 'assetId', A)
    expect(d?.blocks[0].block).toEqual({ t: 'figure', caption: 'Flash EV', alt: '', assetId: A })
  })

  it('is ignored when another article was opened meanwhile', () => {
    const first = asDraft(stored([{ t: 'figure', caption: '', alt: '' }]))
    const second = asDraft(stored([{ t: 'figure', caption: '', alt: '' }], { id: 'other' }))
    expect(withAsset(second, first.session, first.blocks[0].key, 'assetId', A)).toBe(second)
  })

  it('is ignored when its block was removed meanwhile', () => {
    const opened = asDraft(stored([{ t: 'figure', caption: '', alt: '' }]))
    const emptied = edited(opened, { blocks: [] })
    expect(withAsset(emptied, opened.session, opened.blocks[0].key, 'assetId', A)).toBe(emptied)
  })

  it('marks the draft dirty only when it applied', () => {
    const opened = asDraft(stored([{ t: 'figure', caption: '', alt: '' }]))
    expect(isDirty(opened)).toBe(false)
    expect(isDirty(withAsset(opened, opened.session, opened.blocks[0].key, 'assetId', A))).toBe(true)
  })
})

describe('blocks are keyed by identity, not position', () => {
  it('gives every block its own key, and a new article new keys', () => {
    const one = asDraft(stored([{ t: 'p', text: 'a' }, { t: 'p', text: 'b' }]))
    const two = asDraft(stored([{ t: 'p', text: 'a' }]))
    const keys = [...one.blocks, ...two.blocks].map((b) => b.key)
    expect(new Set(keys).size).toBe(keys.length)
    expect(addBlock(one, 'figure').blocks.at(-1)?.key).not.toBe(one.blocks.at(-1)?.key)
  })
})

describe('a save answer lands on what is on screen now', () => {
  it('rebuilds an untouched draft from the stored row, so a cut line shows cut', () => {
    const sent = edited(asDraft(stored([])), { title: '  Body EV vs flash EV  ' })
    const after = afterSave(sent, sent, stored([], { title: 'Body EV vs flash EV' }))
    expect(after?.title).toBe('Body EV vs flash EV')
    expect(isDirty(after)).toBe(false)
  })

  it('keeps what was typed during the round trip, and keeps it dirty', () => {
    const sent = edited(asDraft(stored([])), { title: 'Sent title' })
    const typed = edited(sent, { title: 'Typed after Save' })
    const after = afterSave(typed, sent, {
      ...stored([], { title: 'Sent title' }),
      updatedAt: '2026-10-14T02:00:00.000002+00:00',
    })
    expect(after?.title).toBe('Typed after Save')
    expect(after?.version).toBe('2026-10-14T02:00:00.000002+00:00')
    expect(isDirty(after)).toBe(true)
  })

  it('leaves another article alone', () => {
    const sent = asDraft(stored([]))
    const other = asDraft(stored([], { id: 'other' }))
    expect(afterSave(other, sent, stored([]))).toBe(other)
  })

  it('takes the id and the status a create answered with', () => {
    const sent = edited(blankDraft(), { title: 'New' })
    const after = afterSave(sent, sent, stored([], { id: 'new-2', title: 'New' }))
    expect(after?.id).toBe('new-2')
    expect(after?.status).toBe('draft')
    expect(after?.session).toBe(sent.session)
  })

  it('drops a block the server refused from the screen', () => {
    const sent = asDraft(stored([{ t: 'p', text: 'kept' }, { t: 'p', text: '' }]))
    const after = afterSave(sent, sent, stored([{ t: 'p', text: 'kept' }]))
    expect(after?.blocks.map((b) => b.block)).toEqual([{ t: 'p', text: 'kept' }])
  })

  it('keeps block keys when nothing was dropped, so an upload in flight still lands', () => {
    const sent = asDraft(stored([{ t: 'figure', caption: 'c', alt: '' }]))
    const after = afterSave(sent, sent, stored([{ t: 'figure', caption: 'c', alt: '' }]))
    expect(after?.blocks[0].key).toBe(sent.blocks[0].key)
  })
})

describe('the save body', () => {
  it('names the version it was opened at and sends bare blocks', () => {
    const d = asDraft(stored([{ t: 'p', text: 'a' }]))
    const body = savePayload(d, 'published')
    expect(body.expectedUpdatedAt).toBe(d.version)
    expect(body.status).toBe('published')
    expect(body.blocks).toEqual([{ t: 'p', text: 'a' }])
  })
})

describe('the spec checklist', () => {
  it('does not call a blank article ready to publish', () => {
    expect(publishProblems(blankDraft(), [])).toContain('tooFewBlocks')
  })

  it('applies the rules of the kind on screen, before any save', () => {
    const d = edited(blankDraft(), { kind: 'knowledge' })
    const problems = publishProblems(d, [])
    expect(problems).toContain('knowledgeNeedsSection')
    expect(problems).not.toContain('tooFewBlocks')
  })

  it('carries the server’s unknown links', () => {
    expect(publishProblems(blankDraft(), [{ kind: 'recipe', id: 'scl-999' }])).toContain('relatedUnknown')
  })
})

describe('the leave guard', () => {
  const click = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, defaultPrevented: false }
  const link = (attrs: Record<string, string> = {}) => ({
    getAttribute: (n: string) => attrs[n] ?? null,
    hasAttribute: (n: string) => n in attrs,
  })

  it('asks about a plain click on a link that replaces this page', () => {
    expect(leavesInPlace(click, link({ href: '/admin/wiki' }))).toBe(true)
  })

  it('does not ask about a click that opens elsewhere', () => {
    expect(leavesInPlace({ ...click, metaKey: true }, link())).toBe(false)
    expect(leavesInPlace({ ...click, button: 1 }, link())).toBe(false)
    expect(leavesInPlace(click, link({ target: '_blank' }))).toBe(false)
    expect(leavesInPlace(click, link({ download: '' }))).toBe(false)
    expect(leavesInPlace({ ...click, defaultPrevented: true }, link())).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'
import { ARTICLES, TOPICS } from './articles'
import { buildOutline } from './outline'
import type { Article, Block } from './types'

/**
 * `ARTICLE-SPEC.md` is the contract between a draft and a published article,
 * and most of it is prose a reviewer is meant to hold in their head. The rules
 * that can be counted are counted here, so a fourth TL;DR line or an article
 * that trails off in a paragraph fails the build instead of shipping.
 *
 * One carve-out is encoded rather than assumed: §1 says every heading is
 * followed by a paragraph, and §2.3 (`technique`) puts a menu pair directly
 * under a heading. The two rules contradict each other in the source document.
 * What both are protecting is the same thing — §1 gives the reason, that the
 * paragraph is what the right rail shows as that section's summary — so the
 * assertion below is on the outcome (every section yields a summary line)
 * rather than on the block type, and the `technique` shape is allowed.
 */

const TOPIC_IDS = new Set(TOPICS.map((t) => t.id))

function types(article: Article): readonly Block['t'][] {
  return article.blocks.map((b) => b.t)
}

describe.each(ARTICLES.map((a) => [a.id, a] as const))('%s', (_id, article) => {
  it('carries a topic the rail can show', () => {
    expect(TOPIC_IDS.has(article.topic)).toBe(true)
  })

  it('has a dek short enough for a feed row', () => {
    expect(article.dek.length).toBeLessThanOrEqual(220)
  })

  it('is 8–16 blocks — longer is two articles', () => {
    expect(article.blocks.length).toBeGreaterThanOrEqual(8)
    expect(article.blocks.length).toBeLessThanOrEqual(16)
  })

  it('opens with the TL;DR, then context, before any heading', () => {
    const t = types(article)
    expect(t[0]).toBe('tldr')
    expect(t[1]).toBe('p')
    expect(t.indexOf('h')).toBeGreaterThan(1)
  })

  it('closes with a checklist or a figure, never a paragraph', () => {
    expect(['checklist', 'figure']).toContain(types(article).at(-1))
  })

  it('holds exactly three TL;DR lines, each a single action', () => {
    const tldr = article.blocks.find((b) => b.t === 'tldr')
    expect(tldr).toBeDefined()
    expect(tldr?.items).toHaveLength(3)
    for (const line of tldr?.items ?? []) {
      expect(line.length).toBeLessThanOrEqual(140)
    }
  })

  it('never repeats a block type back to back, except a run of menu pairs', () => {
    const t = types(article)
    for (let i = 1; i < t.length; i += 1) {
      if (t[i] === 'menu') continue
      expect(t[i], `block ${i} repeats ${t[i]}`).not.toBe(t[i - 1])
    }
  })

  it('gives every section a line the right rail can show', () => {
    for (const entry of buildOutline(article.blocks)) {
      expect(entry.precis, `section "${entry.text}" has no summary source`).not.toBe('')
    }
  })

  it('always gives a menu path for both camera generations', () => {
    for (const b of article.blocks) {
      if (b.t !== 'menu') continue
      expect(b.old).toMatch(/^MENU/)
      expect(b.new).toMatch(/^MENU/)
      // The spec fixes the separator: an arrow with a space either side.
      expect(b.old).toContain(' → ')
      expect(b.new).toContain(' → ')
    }
  })

  it('keeps tables at three columns, 3–6 rows, and captioned', () => {
    for (const b of article.blocks) {
      if (b.t !== 'table') continue
      expect(b.head).toHaveLength(3)
      expect(b.rows.length).toBeGreaterThanOrEqual(3)
      expect(b.rows.length).toBeLessThanOrEqual(6)
      for (const row of b.rows) expect(row).toHaveLength(3)
      expect(b.caption.trim()).not.toBe('')
    }
  })

  it('keeps checklists at 3–6 items', () => {
    for (const b of article.blocks) {
      if (b.t !== 'checklist') continue
      expect(b.items.length).toBeGreaterThanOrEqual(3)
      expect(b.items.length).toBeLessThanOrEqual(6)
    }
  })

  it('labels a comparison with real parameters, not "before" and "after"', () => {
    const banned = /^(trước|sau|before|after)$/i
    for (const b of article.blocks) {
      if (b.t !== 'compare') continue
      expect(b.beforeLabel).not.toMatch(banned)
      expect(b.afterLabel).not.toMatch(banned)
      expect(b.caption.trim()).not.toBe('')
    }
  })

  it('labels a callout with its condition, not the word "note"', () => {
    for (const b of article.blocks) {
      if (b.t !== 'callout') continue
      expect(b.label.trim().toLowerCase()).not.toMatch(/^(lưu ý|chú ý|note)$/)
    }
  })

  it('carries no emoji and no exclamation marks', () => {
    // §4: both read as marketing copy, and this is a reference product.
    const prose = JSON.stringify(article)
    expect(prose).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u)
    expect(prose).not.toContain('!')
  })
})

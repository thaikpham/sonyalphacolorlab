import { describe, expect, it } from 'vitest'
import { ARTICLES } from './articles'
import { PRECIS_MAX, buildOutline, buildSummary, truncateOnWord } from './outline'
import type { Block } from './types'

/**
 * The right rail is derived, and derived data is the kind that breaks quietly:
 * nothing throws when a précis comes back empty or when a section's summary
 * belongs to the section above it — the rail just renders slightly wrong text
 * that nobody reads closely enough to notice. These pin the rules the handoff
 * states in prose.
 */

const h = (text: string): Block => ({ t: 'h', text })
const p = (text: string): Block => ({ t: 'p', text })

describe('truncateOnWord', () => {
  it('leaves a short line alone', () => {
    expect(truncateOnWord('Chọn con số nào')).toBe('Chọn con số nào')
  })

  it('cuts on a word boundary, never mid-word', () => {
    const long = 'a'.repeat(40) + ' ' + 'b'.repeat(40) + ' ' + 'c'.repeat(40)
    const out = truncateOnWord(long)
    expect(out.endsWith('…')).toBe(true)
    // Whatever survived is whole words: no fragment of the run it stopped in.
    expect(out.slice(0, -1).split(' ').every((w) => /^(a+|b+|c+)$/.test(w))).toBe(true)
  })

  it('does not leave punctuation stranded before the ellipsis', () => {
    const text = 'Một câu dài để cắt, ' + 'x'.repeat(PRECIS_MAX)
    expect(truncateOnWord(text)).not.toMatch(/[,;:]…$/)
  })

  it('hard-cuts a single word longer than the limit', () => {
    // No boundary to back up to; returning the whole word would blow the rail.
    const out = truncateOnWord('z'.repeat(PRECIS_MAX + 20))
    expect(out.length).toBeLessThanOrEqual(PRECIS_MAX + 1)
  })

  it('collapses the whitespace an author pasted in', () => {
    expect(truncateOnWord('  hai   dòng \n gộp ')).toBe('hai dòng gộp')
  })
})

describe('buildOutline', () => {
  it('takes the précis from the first paragraph of the section, not the next one', () => {
    const outline = buildOutline([
      h('Mục một'),
      p('Đoạn của mục một.'),
      h('Mục hai'),
      p('Đoạn của mục hai.'),
    ])
    expect(outline.map((e) => e.precis)).toEqual(['Đoạn của mục một.', 'Đoạn của mục hai.'])
  })

  it('numbers entries 01, 02 — zero-padded for the tabular column', () => {
    expect(buildOutline([h('a'), h('b')]).map((e) => e.n)).toEqual(['01', '02'])
  })

  it('falls back to a callout, figure or table caption when a section has no paragraph', () => {
    const outline = buildOutline([
      h('Bảng tra'),
      { t: 'table', head: ['a', 'b', 'c'], rows: [], caption: 'Điều kiện đo.' },
    ])
    expect(outline[0].precis).toBe('Điều kiện đo.')
  })

  it('gives an empty précis rather than borrowing the following section', () => {
    const outline = buildOutline([h('Trống'), h('Có đoạn'), p('Của mục sau.')])
    expect(outline[0].precis).toBe('')
    expect(outline[1].precis).toBe('Của mục sau.')
  })

  it('gives every heading a distinct anchor even when two headings read alike', () => {
    // Slugified Vietnamese collides on diacritics; index-based ids cannot.
    const ids = buildOutline([h('Chọn'), p('x'), h('Chon'), p('y')]).map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('buildSummary', () => {
  it('uses the TL;DR when there is one', () => {
    expect(buildSummary(ARTICLES[0])).toHaveLength(3)
  })

  it('falls back to the dek as one row, not a sentence chopped into three', () => {
    const stub = { ...ARTICLES[0], blocks: ARTICLES[0].blocks.filter((b) => b.t !== 'tldr') }
    expect(buildSummary(stub)).toEqual([stub.dek])
  })
})

describe('every published article', () => {
  it.each(ARTICLES.map((a) => [a.id, a] as const))('%s renders a rail', (_id, article) => {
    // A published article with no headings has no contents list, which is a
    // layout the rail does not have a design for.
    expect(buildOutline(article.blocks).length).toBeGreaterThan(0)
    expect(buildSummary(article).length).toBeGreaterThan(0)
  })

  it.each(ARTICLES.map((a) => [a.id, a] as const))(
    '%s keeps every précis inside the rail width',
    (_id, article) => {
      for (const entry of buildOutline(article.blocks)) {
        expect(entry.precis.length).toBeLessThanOrEqual(PRECIS_MAX + 1)
      }
    },
  )
})

/**
 * Everything the article's right rail shows, derived from the article body.
 *
 * The handoff is emphatic that the table of contents' one-line précis is
 * "derived, not authored" — and that is the whole reason this is a module
 * with a test rather than four lines inside the rail component. An authored
 * précis is a second place to update when a section is rewritten, and the one
 * that silently goes stale; deriving it means a heading and its summary can
 * never disagree.
 *
 * Pure functions over the block list, no React and no DOM: the feed renders on
 * the server, and the rail should not be the reason the article view needs a
 * client boundary.
 */

import type { Article, Block } from './types'

/** The handoff's number. Long enough for a clause, short enough for the rail. */
export const PRECIS_MAX = 92

export type OutlineEntry = {
  /** Zero-padded, tabular — "01", "02". Rendered, so it is a string. */
  readonly n: string
  /** `#` target. Index-based, not slugified: two Vietnamese headings that
      differ only in diacritics slugify to the same string, and a duplicate id
      makes the second anchor unreachable. */
  readonly id: string
  readonly text: string
  readonly precis: string
}

/**
 * Truncate on a word boundary, never mid-word.
 *
 * Cutting at exactly `max` characters is what produces "…đo sáng tự độ…" — the
 * ellipsis reads as a typo rather than as a truncation. Backing up to the last
 * space costs a few characters and removes the whole class of complaint.
 * Trailing punctuation goes with it, so the ellipsis never follows a comma.
 */
export function truncateOnWord(text: string, max: number = PRECIS_MAX): string {
  const clean = text.trim().replace(/\s+/g, ' ')
  if (clean.length <= max) return clean

  const cut = clean.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  /* A single word longer than `max` has no boundary to back up to. Hard-cut it
     rather than returning the whole word and blowing the rail's width. */
  const head = lastSpace > 0 ? cut.slice(0, lastSpace) : cut
  return `${head.replace(/[\s,;:.—–-]+$/, '')}…`
}

/**
 * The précis source, in the handoff's priority order: the first paragraph in
 * the section, then the first callout, figure caption or table caption.
 *
 * The fallback chain exists because ARTICLE-SPEC's "every `h` is followed by a
 * `p`" rule is an editorial rule, and editorial rules get broken by drafts.
 * A section that opens on a table should still get a line in the rail rather
 * than an empty row that looks like a rendering failure.
 */
function precisSource(section: readonly Block[]): string {
  for (const b of section) {
    if (b.t === 'p') return b.text
  }
  for (const b of section) {
    if (b.t === 'callout') return b.text
    if (b.t === 'figure') return b.caption
    if (b.t === 'table') return b.caption
  }
  return ''
}

/**
 * One entry per `h` block, each carrying the précis of the blocks that follow
 * it up to the next `h`.
 */
export function buildOutline(blocks: readonly Block[]): readonly OutlineEntry[] {
  const entries: OutlineEntry[] = []

  blocks.forEach((block, i) => {
    if (block.t !== 'h') return

    /* The section runs to the next heading, or to the end of the article. */
    let end = blocks.length
    for (let j = i + 1; j < blocks.length; j += 1) {
      if (blocks[j].t === 'h') {
        end = j
        break
      }
    }

    const precis = precisSource(blocks.slice(i + 1, end))
    entries.push({
      n: String(entries.length + 1).padStart(2, '0'),
      id: headingId(i),
      text: block.text,
      precis: precis ? truncateOnWord(precis) : '',
    })
  })

  return entries
}

/** The id an `h` at block index `i` carries. One definition, two call sites. */
export function headingId(blockIndex: number): string {
  return `h-${blockIndex}`
}

/**
 * The three lines of the summary card: the article's TL;DR, or its dek when
 * the article has none.
 *
 * The dek is one sentence and the card renders three rows, so the fallback is
 * a single row rather than the dek chopped into thirds — a split sentence
 * reads as a bug, a short card reads as a short article.
 */
export function buildSummary(article: Article): readonly string[] {
  const tldr = article.blocks.find((b) => b.t === 'tldr')
  return tldr ? [...tldr.items] : [article.dek]
}

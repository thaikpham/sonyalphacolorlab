import { describe, expect, it } from 'vitest'
import type { SearchDoc } from './documents'
import { seedCorpus } from './evaluation/corpus'
import { parseQuery, prepare, rank, scoreDoc } from './rank'
import type { SearchKind } from './types'

/**
 * The ranker's own rules, one document at a time. The evaluation set measures
 * the outcome over the corpus; these pin the mechanics it rests on, which an
 * aggregate threshold can absorb a regression in without failing.
 */

const doc = (over: Partial<SearchDoc> & { id: string }): SearchDoc => ({
  kind: 'article',
  title: over.id,
  url: `/x/${over.id}`,
  contentLanguage: 'en',
  exact: [],
  aliases: [],
  titleText: '',
  summary: '',
  tags: [],
  headings: [],
  body: '',
  boost: 0,
  display: {},
  ...over,
})

const ids = (q: string, docs: readonly SearchDoc[]) => rank(q, docs.map(prepare)).map((r) => r.doc.id)

describe('parseQuery', () => {
  it('refuses a query with no letters or digits', () => {
    expect(parseQuery('!!!')).toBeNull()
    expect(parseQuery('   ')).toBeNull()
    expect(rank('!!!', [prepare(doc({ id: 'a', titleText: 'anything' }))])).toEqual([])
  })
})

describe('rank', () => {
  it('breaks a tie on kind, recipe first, then on title', () => {
    const same = { titleText: 'Mojave' }
    const docs = [
      doc({ id: 'art', kind: 'article', title: 'A', ...same }),
      doc({ id: 'know', kind: 'knowledge', title: 'A', ...same }),
      doc({ id: 'prod', kind: 'product', title: 'A', ...same }),
      doc({ id: 'rec-b', kind: 'recipe', title: 'B', ...same }),
      doc({ id: 'rec-a', kind: 'recipe', title: 'A', ...same }),
    ]
    expect(ids('mojave', docs)).toEqual(['rec-a', 'rec-b', 'prod', 'know', 'art'])
  })

  it('never lets a pile of weaker fields overtake a stronger one', () => {
    /* Each further field breaks a tie by a few points; five of them must
       still fall short of the gap to the next tier. */
    const everywhereElse = doc({
      id: 'weak',
      kind: 'recipe',
      summary: 'mojave',
      tags: ['mojave'],
      headings: ['mojave'],
      body: 'mojave',
      boost: 1,
    })
    const titleOnly = doc({ id: 'strong', kind: 'article', titleText: 'Mojave Sun' })
    expect(ids('mojave', [everywhereElse, titleOnly])).toEqual(['strong', 'weak'])
  })

  it('places an exact id above a title that merely contains it', () => {
    const docs = [
      doc({ id: 'title', titleText: 'Using SCL PP 001 at dusk' }),
      doc({ id: 'exact', exact: ['sclpp001'], titleText: 'Mojave Sun' }),
    ]
    expect(ids('SCL-PP-001', docs)[0]).toBe('exact')
  })

  it('finds the same bodies for α7 as for a7', () => {
    const products = seedCorpus('en').filter((d) => d.kind === ('product' satisfies SearchKind))
    const a7 = ids('a7', products)
    expect(a7.length).toBeGreaterThan(3)
    expect(ids('α7', products)).toEqual(a7)
    expect(ids('α7 IV', products)[0]).toBe(ids('a7 IV', products)[0])
  })
})

describe('scoreDoc', () => {
  it('does not report a tag match when the words were spread over other fields', () => {
    /* Every word found, no field holding them all: its own reason, because
       the reasons are what the API explains a hit with. */
    const s = scoreDoc(parseQuery('alpha beta gamma delta')!, prepare(doc({
      id: 'x',
      titleText: 'alpha one two three',
      headings: ['beta four five six'],
      body: 'gamma delta seven',
    })))
    expect(s?.reasons).toContain('spread')
    expect(s?.reasons).not.toContain('tag')
  })

  it('treats a trailing space like no space', () => {
    /* Every entry point trims the query before it gets here, so a "finished
       word" signal would only ever fire for a hand-edited URL — and make
       that one URL disagree with the dropdown. */
    const docs = seedCorpus('en').filter((d) => d.kind === 'product')
    expect(ids('a7 ', docs)).toEqual(ids('a7', docs))
    const iso = [doc({ id: 'x', titleText: 'Isolation' })]
    expect(ids('iso ', iso)).toEqual(ids('iso', iso))
  })

  it('returns reasons, strongest first', () => {
    const q = parseQuery('mojave')!
    const s = scoreDoc(q, prepare(doc({ id: 'x', titleText: 'Mojave', body: 'mojave' })))
    expect(s?.reasons[0]).toBe('title')
    expect(s?.reasons).toContain('body')
  })
})

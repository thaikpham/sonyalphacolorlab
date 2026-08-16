import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { REPO_ROOT, scanRepo, scanSource, tally, totals } from './floor'

/**
 * The enforceable part of the design system.
 *
 * `DESIGN.md` carries eight audit greps and `/design-sync` runs them, but both
 * are things a person has to remember. Three of the nine rules are countable,
 * and those three are the ones that had quietly spread to ~1,100 call sites
 * while every review passed: type under the 13px floor, a second font family,
 * and a Tailwind default palette colour in an OKLCH interface.
 *
 * The check is an EXACT match against a recorded baseline, not a ceiling. A
 * ceiling lets a fix in one file silently pay for a regression in another — the
 * total stays flat while the code gets worse in the places nobody looked. Exact
 * matching means every change to these numbers shows up in a baseline diff and
 * has to be looked at.
 *
 * When this fails:
 *   - the number went UP → you added a violation. Fix it.
 *   - the number went DOWN → you fixed some. Run `npm run design:baseline`
 *     and commit the diff; it should be all decreases.
 */
const BASELINE = JSON.parse(
  readFileSync(join(REPO_ROOT, 'src/design/floor.baseline.json'), 'utf8'),
) as Record<string, { belowFloor: number; mono: number; palette: number }>

describe('design floor', () => {
  const current = tally(scanRepo())

  it('matches the recorded baseline exactly', () => {
    expect(
      current,
      'Design-system violation counts moved. If they went UP, fix the violation.\n' +
        'If they went DOWN, run `npm run design:baseline` and commit the diff.',
    ).toEqual(BASELINE)
  })

  it('has not regressed on the totals', () => {
    const now = totals(current)
    const then = totals(BASELINE)
    expect(now.belowFloor).toBeLessThanOrEqual(then.belowFloor)
    expect(now.mono).toBeLessThanOrEqual(then.mono)
    expect(now.palette).toBeLessThanOrEqual(then.palette)
  })

  /**
   * The guard on the guard. Every assertion above passes vacuously if the
   * scanner stops matching — a regex typo, a changed file filter — and a green
   * suite with a blind scanner is worse than no scanner, because it is trusted.
   */
  describe('the scanner still works', () => {
    it.each([
      ['text-[10px]', 'belowFloor'],
      ['text-[0.65rem]', 'belowFloor'],
      ['text-xs', 'belowFloor'],
      ['font-mono', 'mono'],
      ['text-amber-400', 'palette'],
      ['bg-emerald-500', 'palette'],
      ['border-slate-300', 'palette'],
    ])('flags %s as %s', (snippet, rule) => {
      const found = scanSource(`const c = "flex ${snippet} items-center"`, 'probe.tsx')
      expect(found.map((v) => v.rule)).toContain(rule)
    })

    it.each([
      'text-sm',
      'text-body',
      'text-label',
      'text-meta',
      'text-ink-faint',
      'bg-accent-500',
      'text-community',
      'tabular-nums',
    ])('leaves %s alone', (snippet) => {
      expect(scanSource(`const c = "flex ${snippet}"`, 'probe.tsx')).toEqual([])
    })

    /* The reason `stripComments` exists. These three files document the rules,
       so they name the very patterns the scanner hunts — and were the last
       three reported as breaking them. A guard that fires on its own
       documentation gets muted rather than obeyed; `token-drift.test.ts`
       records the same lesson after failing on a hex written inside a prose
       string describing the page background. */
    it.each([
      '/* never write text-[10px] or font-mono */',
      '// text-amber-400 was deleted from here',
      '/**\n * Multi-line: text-[9px], text-xs and bg-slate-700 all banned.\n */',
    ])('ignores the pattern inside a comment', (source) => {
      expect(scanSource(source, 'probe.ts')).toEqual([])
    })

    it('still reads a class that follows a comment on the same line', () => {
      const found = scanSource('const c = "text-xs" // was text-[10px]', 'probe.ts')
      expect(found).toHaveLength(1)
      expect(found[0].text).toBe('text-xs')
    })

    /* A URL is not a comment. `https://…` contains `//`, and a naive line-
       comment strip blanks the rest of the line — which would silently hide
       every violation written after any link in the file. */
    it('does not treat a URL as the start of a comment', () => {
      const found = scanSource(
        'const src = "https://example.com/a"; const c = "font-mono";',
        'probe.ts',
      )
      expect(found.map((v) => v.rule)).toContain('mono')
    })
  })
})

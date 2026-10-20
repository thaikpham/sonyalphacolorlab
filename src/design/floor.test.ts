import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { TEXT } from '../../packages/colorlab-tokens/src/tokens'
import { FLOOR_PX, REPO_ROOT, scanRepo, scanSource, tally, totals } from './floor'

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
      /* Shapes the first patterns missed: a side or offset segment before the
         hue, a palette variable read directly, the `length:` type hint, the
         `font` shorthand, a JSX style object, and the mono stacks CLAUDE.md's
         own audit grep lists. */
      ['border-t-red-500', 'palette'],
      ['border-x-amber-400', 'palette'],
      ['ring-offset-green-500', 'palette'],
      ['color: var(--color-sky-300)', 'palette'],
      ['text-[length:11px]', 'belowFloor'],
      ['font: 600 11px/1 sans-serif', 'belowFloor'],
      ["fontSize: '11px'", 'belowFloor'],
      ['fontSize: 11', 'belowFloor'],
      ['font-family: ui-monospace', 'mono'],
      ['font-family: monospace', 'mono'],
      ["font-family: 'Noto Sans Mono'", 'mono'],
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
      'font: inherit',
      'fontSize: 15',
      'ring-offset-2',
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

    // A comment opener inside a string is not a comment. The old strip blanked
    // from `accept="image/*"` to the next comment close, hiding everything
    // between — and strings are exactly where the classes live.
    it('does not treat /* inside a string as a comment', () => {
      const found = scanSource('const a = "image/*"; const c = "text-[10px]"; /* x */', 'p.tsx')
      expect(found.map((v) => v.rule)).toEqual(['belowFloor'])
    })

    it('does not treat // inside a string as a comment', () => {
      const found = scanSource("const a = 'a // b'; const c = 'font-mono';", 'p.ts')
      expect(found.map((v) => v.rule)).toEqual(['mono'])
    })

    it('keeps line numbers through a blanked comment', () => {
      const found = scanSource('/* one\ntwo */\nconst c = "font-mono"', 'p.ts')
      expect(found[0].line).toBe(3)
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

/* The scanner reads call sites, not the scale itself: `meta: '0.8125rem'` is a
   bare rem string, and theme.css — where it becomes a font size — is vendored
   and out of scope. Shrink a step in tokens.ts and every `.meta` drops below
   the floor with the scan green. */
describe('the type scale', () => {
  it.each(Object.entries(TEXT.tokens))('--text-%s (%s) is at or above the floor', (_name, value) => {
    const m = value.match(/^(\d*\.?\d+)(px|rem)$/)
    expect(m, `${value} is not a px or rem length`).not.toBeNull()
    const px = m![2] === 'rem' ? Number(m![1]) * 16 : Number(m![1])
    expect(px).toBeGreaterThanOrEqual(FLOOR_PX)
  })
})

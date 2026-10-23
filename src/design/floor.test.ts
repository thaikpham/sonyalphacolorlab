import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { TEXT } from '../../packages/colorlab-tokens/src/tokens'
import { FLOOR_PX, REPO_ROOT, RULES, scanRepo, scanSource, tally, totals, type Baseline } from './floor'

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
) as Baseline

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
    for (const rule of RULES) expect(now[rule], rule).toBeLessThanOrEqual(then[rule])
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
      /* The six rules that used to be DESIGN.md's greps. */
      ['#8A9CFF', 'hex'],
      ['color: #fff', 'hex'],
      ['border-t-2', 'stroke'],
      ['ring-2', 'stroke'],
      ['outline-1', 'stroke'],
      ['border-solid', 'stroke'],
      ['className="eyebrow"', 'deletedVocab'],
      ['var(--font-display)', 'deletedVocab'],
      ['animate-radar-sweep', 'deletedVocab'],
      ['::-webkit-scrollbar { display: none }', 'scrollbarCss'],
      ['scrollbar-width: none', 'scrollbarCss'],
      ['h-[38px]', 'arbitraryPx'],
      ['text-[15px]', 'arbitraryPx'],
      ['duration-200', 'duration'],
      ['duration-[250ms]', 'duration'],
      /* Tailwind v4's bare stroke classes are 1px, and DESIGN.md's grep could not see them. */
      ['border', 'stroke'],
      ['hover:ring', 'stroke'],
      ['outline', 'stroke'],
      ['not-focus-visible:ring-2', 'stroke'],
      /* `.glass` the deleted primitive, as a class and as a selector. */
      ['glass p-4', 'deletedVocab'],
      ['.glass { opacity: 1 }', 'deletedVocab'],
    ])('flags %s as %s', (snippet, rule) => {
      // `hex` is scoped to src/components and src/app, so the probe lives there.
      const found = scanSource(`const c = "flex ${snippet} items-center"`, 'src/components/x.tsx')
      expect(found.map((v) => v.rule)).toContain(rule)
    })

    /* A raw `transition` with a time is a stylesheet shape; the scanner reads
       it in `.css` files, where `duration-*` classes do not occur. */
    it('flags a transition with a time of its own in a stylesheet', () => {
      const found = scanSource('.x { transition: opacity 0.18s ease; }', 'src/components/x.css')
      expect(found.map((v) => v.rule)).toEqual(['duration'])
    })

    it.each([
      ['focus-visible:ring-2', 'stroke'],
      ['btn-glass', 'deletedVocab'],
      ['bg-glass-raised', 'deletedVocab'],
      ['var(--color-glass)', 'deletedVocab'],
      ['scroll-silent', 'scrollbarCss'],
      ['scroll-area', 'scrollbarCss'],
      ['#about', 'hex'],
      ['duration-(--motion)', 'duration'],
      /* A zero width removes a stroke; it does not draw one. */
      ['border-0', 'stroke'],
      ['"focus-visible:outline"', 'stroke'],
      ["style={{ border: 'none' }}", 'stroke'],
      ['props.outline', 'stroke'],
      ['const ring = box * 0.42', 'stroke'],
      ["import { buildOutline } from '@/lib/lab/outline'", 'stroke'],
      ['{outline.map((entry) => entry)}', 'stroke'],
      ['"ring-offset-2"', 'stroke'],
      /* An HTML entity is not a colour. */
      ['&#123;', 'hex'],
      /* One site, one rule: a sub-floor size is belowFloor's. */
      ['text-[10px]', 'arbitraryPx'],
    ])('does not count %s as %s', (sample, rule) => {
      expect(scanSource(sample, 'src/components/x.tsx').filter((v) => v.rule === rule)).toEqual([])
    })

    it.each([
      ['.x { animation: spin 1s linear infinite; }', 'src/components/x.css'],
      [
        '@media (prefers-reduced-motion: no-preference) {\n  .x { transition: opacity 200ms; }\n}',
        'packages/colorlab-tokens/src/primitives.css',
      ],
    ])('flags a duration of its own in %s', (source, file) => {
      expect(scanSource(source, file).map((v) => v.rule)).toEqual(['duration'])
    })

    it('does not read a CSS property or transition target as a bare stroke', () => {
      const source = '.x { border: 3px solid transparent; transition: border 0.2s; }'
      expect(scanSource(source, 'src/app/globals.css').filter((v) => v.rule === 'stroke')).toEqual([])
    })

    /* `comment:` blanking is the token source's alone. Anywhere else a
       `comment: '` would swallow real code up to the next quote. */
    it('reads the code after a comment: inside a line comment', () => {
      const source = "// reviewer's comment: 'needs work\nconst c = \"text-xs border-2\"\nconst d = 'y'"
      expect(scanSource(source, 'src/components/x.tsx').map((v) => v.rule).sort()).toEqual([
        'belowFloor',
        'stroke',
      ])
    })

    it('reads a comment: key in a component', () => {
      const found = scanSource("const o = { comment: 'text-xs', cls: 'text-xs' }", 'src/components/x.tsx')
      expect(found.map((v) => v.rule)).toEqual(['belowFloor', 'belowFloor'])
    })

    it('counts glass as an object key in a component', () => {
      const found = scanSource('cond({ glass: open })', 'src/components/x.tsx')
      expect(found.map((v) => v.rule)).toEqual(['deletedVocab'])
    })

    it.each(['src/components/icon.tsx', 'src/app/apple-icon.tsx'])(
      'counts a hex in %s (not a file DESIGN.md names)',
      (file) => {
        expect(scanSource('fill="#07080B"', file).map((v) => v.rule)).toEqual(['hex'])
      },
    )

    it('counts a stroke beside a focus-visible one on the same line', () => {
      const found = scanSource('"border-2 focus-visible:ring-2"', 'src/components/x.tsx')
      expect(found.filter((v) => v.rule === 'stroke').map((v) => v.text)).toEqual(['border-2'])
    })

    it.each([
      ['src/app/icon.tsx', '#07080B', 'hex'],
      ['src/app/opengraph-image.tsx', '#07080B', 'hex'],
      ['src/app/manifest.ts', '#07080B', 'hex'],
      ['src/components/auth-context.tsx', 'themeColor: "#07080B"', 'hex'],
      [
        'src/components/auth-context.tsx',
        'export function GoogleMark() {\n  return <path fill="#4285F4" />\n}',
        'hex',
      ],
      ['src/app/globals.css', '::-webkit-scrollbar { width: 6px }', 'scrollbarCss'],
      ['src/app/globals.css', 'transition: opacity 0.18s ease', 'duration'],
      ['src/lib/camera/color.ts', '#8A9CFF', 'hex'],
      ['src/app/[locale]/recipe/[slug]/opengraph-image.tsx', '#07080B', 'hex'],
      [
        'packages/colorlab-tokens/src/primitives.css',
        '@media (prefers-reduced-motion: reduce) {\n  * { transition-duration: 0.01ms !important; }\n}',
        'duration',
      ],
      ['packages/colorlab-tokens/src/tokens.ts', "tokens: {\n  glass: 'oklch(100% 0 0 / 0.05)',\n}", 'deletedVocab'],
      ['src/app/recipe-page.test.ts', "it('puts no eyebrow over the heading', () => {})", 'deletedVocab'],
    ])('does not count %s in %s (DESIGN.md names the exception)', (file, sample, rule) => {
      expect(scanSource(sample, file).filter((v) => v.rule === rule)).toEqual([])
    })

    it('still counts a transition after the reduced-motion block closes', () => {
      const source =
        '@media (prefers-reduced-motion: reduce) {\n  * { transition-duration: 0.01ms; }\n}\n' +
        '.x { transition: opacity 200ms; }'
      const found = scanSource(source, 'packages/colorlab-tokens/src/primitives.css')
      expect(found.map((v) => [v.rule, v.line])).toEqual([['duration', 4]])
    })

    /* `TokenGroup.comment` is the token source's documentation, emitted as a
       CSS comment. It names the sizes, families and words the rules ban. */
    it('ignores the pattern inside a comment: property', () => {
      const source =
        "export const TEXT = {\n  comment:\n    'fails on text-[9px] and --font-mono\\n' +\n" +
        "    'and the three glass layers.',\n  tokens: { meta: '0.8125rem' },\n}"
      expect(scanSource(source, 'packages/colorlab-tokens/src/tokens.ts')).toEqual([])
    })

    it('reads the code after a comment: property', () => {
      const source = "const g = {\n  comment: 'about text-xs',\n  cls: 'text-xs',\n}"
      expect(scanSource(source, 'packages/colorlab-tokens/src/tokens.ts').map((v) => [v.rule, v.line])).toEqual([
        ['belowFloor', 3],
      ])
    })

    it('counts a hex in the component after GoogleMark', () => {
      const source =
        'export function GoogleMark() {\n  return <path fill="#4285F4" />\n}\n' +
        'export function Other() {\n  return <path fill="#123456" />\n}'
      const found = scanSource(source, 'src/components/auth-context.tsx')
      expect(found.filter((v) => v.rule === 'hex').map((v) => v.text)).toEqual(['#123456'])
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

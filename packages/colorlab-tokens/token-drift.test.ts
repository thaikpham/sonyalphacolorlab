/**
 * Fails when ColorLab's copy of the shared design system stops matching the
 * source in packages/colorlab-tokens.
 *
 * The tokens were once copy-pasted by hand between three apps and had drifted in
 * exactly the ways you would predict: `.glass` grew a border in the two
 * siblings, `.tabular` resolved to mono in one and sans in another, the whole
 * signal-colour family was missing from both, and CheeseBooth referenced a
 * `film-burn-pulse` animation nobody had defined.
 *
 * Same defence the SQL CHECK constraints get from sql-drift.test.ts: state the
 * value once, then fail loudly when a copy disagrees.
 *
 * **Scope, and why it shrank.** CheeseBooth and Sony Live SOP are their own
 * repos again, so this test asserts only about paths this repo owns. That is
 * deliberate and it is the *safe* direction: the version of this file that
 * reached into sibling folders by relative path had an
 * `if (!existsSync(path)) return` escape hatch, so on a checkout without them
 * every assertion passed vacuously and the suite went green with an entire app
 * missing. A guard that names a path outside its own repo is a guard that can be
 * satisfied by absence. Within this repo a missing file is still the loudest
 * possible failure — see the assertion below.
 *
 * Nothing now checks the two siblings' copies. That is a real gap and it belongs
 * to them; it is not fixable from here, and pretending otherwise is what the
 * vacuous pass was.
 *
 * The expected contents are computed in-process from generate(). The first
 * version of this file shelled out to the emitter instead — which rewrote every
 * copy before the comparisons ran and healed the drift it was supposed to catch.
 * It passed against deliberately corrupted files. Never let a check repair its
 * own subject.
 */

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { APP_SPECIFIC, COLOR_GROUPS, NAMESPACED_GROUPS, PAPER, SIGNALS } from './src/tokens'
import { generate, TARGETS } from './src/generate'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..', '..')
const DIST = join(HERE, 'dist')

const EXPECTED = generate()

describe.each(TARGETS)('$file', ({ file, destinations }) => {
  const canonical = EXPECTED[file]

  it('the package dist copy is current', () => {
    expect(
      readFileSync(join(DIST, file), 'utf8'),
      `dist/${file} is stale — run \`npm run tokens:emit\``,
    ).toBe(canonical)
  })

  // `tokens.css` has no in-repo destination — it is emitted to dist/ for the
  // no-Tailwind consumer that now lives in another repo. An empty `it.each` is
  // an error in vitest, not zero tests, so the guard is on the describe.
  if (destinations.length > 0) {
    it.each(destinations)('%s is byte-identical to the source', (destination) => {
      const path = join(REPO_ROOT, destination)

      // No escape hatch. This once read `if (!existsSync(path)) return`, which
      // is how an absent app produced a green suite. Every destination left in
      // TARGETS is one this repo owns, so a missing file is a failure.
      expect(existsSync(path), `${destination} is missing — this repo should always contain it`).toBe(true)

      expect(
        readFileSync(path, 'utf8'),
        `${destination} has drifted from the source — run \`npm run tokens:emit\``,
      ).toBe(canonical)
    })
  }
})

describe('the app does not redefine a shared token', () => {
  /* Re-declaring one of these locally wins the cascade silently, which is the
     failure mode this whole package exists to prevent.

     Derived from the source rather than listed by hand. The hand-written list
     this replaced had gone stale the moment a group was added — it never named
     `--font-sans`, `--layout-touch-target` or anything under `--text-*`, so a
     local override of any of them was waved straight through by a test whose
     whole job was to catch exactly that. A guard that has to be edited in step
     with the thing it guards is a guard that will not be. */
  /* Nothing is exempt any more, and that is the point of v2.
     `--font-sans` used to be: ColorLab loaded its faces through next/font,
     which hashes the family name into a per-app variable, so the app had to
     restate the stack in terms of its own hash and no two apps in the
     ecosystem could name the same face. That indirection IS what the feedback
     called "font không đồng đều". The faces are now vendored into
     public/fonts/noto-sans and declared with one literal family name, so
     `--font-sans` is an ordinary shared token and an app-local copy of it is
     the same silent cascade win as any other. `--font-mono` no longer exists. */
  const EXEMPT = new Set<string>([])

  const OWNED = [
    ...COLOR_GROUPS.flatMap((group) => Object.keys(group.tokens).map((name) => `--color-${name}`)),
    ...NAMESPACED_GROUPS.flatMap(({ namespace, group }) =>
      Object.keys(group.tokens).map((name) => `--${namespace}-${name}`),
    ),
  ].filter((token) => !EXEMPT.has(token))

  it('is derived from the token source and is not empty', () => {
    /* A `.filter()` that matched everything would make every assertion below
       pass vacuously — the same shape of hole as the `if (!existsSync) return`
       described at the top of this file. */
    expect(OWNED.length).toBeGreaterThan(20)
    expect(OWNED).toContain('--color-accent-400')
    expect(OWNED).toContain('--text-meta')
    expect(OWNED).toContain('--font-sans')
  })

  /** The app's own stylesheet — the one place a redeclaration would hide. */
  const APP_STYLESHEETS = ['src/app/globals.css']

  it.each(APP_STYLESHEETS)('%s declares none of them', (stylesheet) => {
    const path = join(REPO_ROOT, stylesheet)
    expect(existsSync(path), `${stylesheet} is missing`).toBe(true)

    // Strip comments: the prose in these files names the tokens it is
    // explaining, and a comment is not a declaration.
    const css = readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

    // Deliberately NOT anchored to the line start. `:root { --color-void: … }`
    // on one line is still a redeclaration, and an earlier `^\s*` version of
    // this regex waved exactly that through.
    const redeclared = OWNED.filter((token) =>
      new RegExp(`(^|[{;\\s])${token}\\s*:`).test(css),
    )

    expect(
      redeclared,
      `${stylesheet} redeclares shared tokens; delete them and let the imported file win`,
    ).toEqual([])
  })
})

describe('the app imports the shared files', () => {
  const IMPORTERS: ReadonlyArray<[string, readonly string[]]> = [
    /* `vfx.css` is gone — the whole effects layer (Y2K badges, holo lens, laser
       grid, radar sweep, glitch text, floating cards, water ripples) was what
       the feedback read as machine-generated, and it is not coming back. */
    ['src/app/globals.css', ['theme.css', 'primitives.css']],
  ]

  it.each(IMPORTERS)('%s imports %s', (stylesheet, expectedImports) => {
    const path = join(REPO_ROOT, stylesheet)
    expect(existsSync(path), `${stylesheet} is missing`).toBe(true)

    const css = readFileSync(path, 'utf8')
    for (const file of expectedImports) {
      expect(css, `${stylesheet} does not import colorlab-tokens/${file}`).toContain(
        `colorlab-tokens/${file}`,
      )
    }
  })
})

describe('the source stays in OKLCH', () => {
  /* Checks the token VALUES, not the source text. An earlier version scanned
     the file with code-comments stripped and failed on `#040406` written inside
     a `comment:` string — prose describing the page background, not a token.
     A guard that fires on its own documentation gets deleted, not obeyed. */
  const colourTokens = COLOR_GROUPS.flatMap((group) => Object.entries(group.tokens))

  it.each(colourTokens)('%s is declared in oklch()', (name, value) => {
    expect(value, `${name} must be OKLCH, not sRGB`).toMatch(/^oklch\(/)
  })

  it('has no sRGB hex anywhere in a token value', () => {
    const everyValue = [...COLOR_GROUPS, ...NAMESPACED_GROUPS.map((n) => n.group)].flatMap(
      (group) => Object.values(group.tokens),
    )

    expect(everyValue.filter((value) => /#[0-9a-fA-F]{3,8}\b/.test(value))).toEqual([])
  })
})

/* ---------------------------------------------------------------------------
   Rules, not just tokens.
--------------------------------------------------------------------------- */

const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '')

/**
 * Every rule as its at-rule/nesting context plus one selector, e.g.
 * `@media (pointer: coarse)` and `a.label`. Nesting is followed, so a rule
 * inside `@layer components { :root:has(.theme-paper) { … } }` keeps both.
 * Enough of a parser for these two hand-written files, which is all it reads.
 */
function rules(css: string): { context: string; selector: string; body: string }[] {
  const out: { context: string; selector: string; body: string }[] = []
  const stack: { prelude: string; body: string }[] = []
  let pending = ''
  for (const ch of stripComments(css)) {
    if (ch === '{') {
      stack.push({ prelude: pending.trim(), body: '' })
      pending = ''
    } else if (ch === '}') {
      const rule = stack.pop()
      if (rule && !rule.prelude.startsWith('@')) {
        const context = stack.map((r) => r.prelude).join(' | ')
        for (const selector of rule.prelude.split(',').map((s) => s.trim()).filter(Boolean)) {
          out.push({ context, selector, body: (rule.body + pending).trim() })
        }
      }
      pending = ''
    } else if (ch === ';') {
      if (stack.length > 0) stack[stack.length - 1].body += `${pending.trim()};`
      pending = ''
    } else {
      pending += ch
    }
  }
  return out
}

const read = (path: string) => readFileSync(join(REPO_ROOT, path), 'utf8')
const PRIMITIVES = read('packages/colorlab-tokens/src/primitives.css')
const GLOBALS = read('src/app/globals.css')
const key = (r: { context: string; selector: string }) => `${r.context} :: ${r.selector}`

describe('the app does not restate a shared primitive', () => {
  /* globals.css loads after primitives.css, so a copy of a shared rule here
     silently overrides any later change made there — the 4px focus radius
     primitives.css describes survived into every app exactly that way. */
  it('is parsing something', () => {
    expect(rules(PRIMITIVES).map(key)).toContain(' :: :focus-visible')
    expect(rules(PRIMITIVES).map(key)).toContain('@media (pointer: coarse) :: a.label')
  })

  it('declares no rule primitives.css already declares, in the same context', () => {
    const shared = new Set(rules(PRIMITIVES).map(key))
    expect(rules(GLOBALS).map(key).filter((k) => shared.has(k))).toEqual([])
  })
})

describe('one family, code included', () => {
  /* Tailwind's preflight sets code/kbd/samp/pre to its monospace stack with a
     literal `monospace` fallback, so nulling `--font-mono` would not reach it. */
  it.each(['code', 'kbd', 'samp', 'pre'])('primitives.css resets %s to the inherited family', (tag) => {
    const reset = rules(PRIMITIVES).find((r) => r.context === '' && r.selector === tag)
    expect(reset?.body).toMatch(/font-family:\s*inherit/)
  })
})

describe('globals.css cascade order', () => {
  /* Same layer, same specificity: the later rule wins. `.chip` after
     `.surface-selected` rendered a selected chip as an ordinary one. */
  it('declares .surface-selected after .chip in both rooms', () => {
    const all = rules(GLOBALS)
    const order = all.map(key)
    const contexts = [...new Set(all.filter((r) => r.selector === '.chip').map((r) => r.context))]
    expect(contexts).toHaveLength(2)
    for (const context of contexts) {
      const chip = order.indexOf(key({ context, selector: '.chip' }))
      const selected = order.indexOf(key({ context, selector: '.surface-selected' }))
      expect(selected, context).toBeGreaterThan(chip)
    }
  })

  it('keeps hover off a selected chip', () => {
    const hovers = rules(GLOBALS).filter((r) => /\.chip-action.*:hover/.test(r.selector))
    expect(hovers.length).toBeGreaterThan(0)
    for (const r of hovers) expect(r.selector).toContain(':not(.surface-selected)')
  })
})

describe('APP_SPECIFIC is the whole list', () => {
  /* It was exported and read by nothing, so nothing noticed it was wrong: it
     left out `--selected-hue`. It is now the exemption list for the custom
     properties an app stylesheet may declare that the package does not own. */
  it('names every custom property globals.css declares', () => {
    const declared = new Set(
      [...stripComments(GLOBALS).matchAll(/(?:^|[{;\s])(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]),
    )
    expect(declared.size).toBeGreaterThan(0)
    const allowed: readonly string[] = APP_SPECIFIC
    expect([...declared].filter((p) => !allowed.includes(p))).toEqual([])
  })
})

describe('the paper room keeps the signals legible', () => {
  /* /admin is paper and sets errors and statuses in `text-danger`,
     `text-proposal` and `text-community` at 13–14px. The dark-ground values
     measure 2.2–3.7:1 on the paper void. */
  const paper = PAPER.find((p) => p.namespace === 'color')!.group.tokens

  it.each(Object.keys(SIGNALS.tokens))('restates %s at 4.5:1 or better on the paper ground', (name) => {
    expect(paper[name], `PAPER does not restate --color-${name}`).toBeDefined()
    expect(contrast(paper[name], paper.void)).toBeGreaterThanOrEqual(4.5)
  })

  it('measures the way the comment says', () => {
    // The ink steps PAPER documents as 16.5 / 10.4 / 5.6:1, as a check on the maths.
    expect(contrast(paper['ink-faint'], paper.void)).toBeCloseTo(5.95, 1)
  })
})

/** WCAG contrast of two opaque `oklch()` values, via OKLab → linear sRGB, clipped. */
function contrast(a: string, b: string): number {
  const [la, lb] = [luminance(a), luminance(b)]
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

function luminance(value: string): number {
  const m = value.match(/^oklch\(([\d.]+)%\s+([\d.]+)\s+([\d.]+)\)$/)
  if (!m) throw new Error(`not an opaque oklch(): ${value}`)
  const L = Number(m[1]) / 100
  const C = Number(m[2])
  const h = (Number(m[3]) * Math.PI) / 180
  const A = C * Math.cos(h)
  const B = C * Math.sin(h)
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3
  const mm = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3
  const clip = (x: number) => Math.min(1, Math.max(0, x))
  const r = clip(4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s)
  const g = clip(-1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s)
  const bl = clip(-0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * s)
  return 0.2126 * r + 0.7152 * g + 0.0722 * bl
}

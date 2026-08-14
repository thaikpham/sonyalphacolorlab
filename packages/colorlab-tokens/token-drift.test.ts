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

import { COLOR_GROUPS, NAMESPACED_GROUPS } from './src/tokens'
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

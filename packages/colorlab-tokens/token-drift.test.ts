/**
 * Fails when any app's copy of the shared design system stops matching the
 * source in packages/colorlab-tokens.
 *
 * The three apps deploy from three separate git repos to three separate Vercel
 * projects, so nothing else can see all of them at once. Before this test, the
 * tokens were copy-pasted by hand and had drifted in exactly the ways you would
 * predict: `.glass` grew a border in the two siblings, `.tabular` resolved to
 * mono in one and sans in another, the whole signal-colour family was missing
 * from both, and CheeseBooth referenced a `film-burn-pulse` animation nobody
 * had defined.
 *
 * Same defence the SQL CHECK constraints get from sql-drift.test.ts: state the
 * value once, then fail loudly when a copy disagrees.
 *
 * The expected contents are computed in-process from generate(). The first
 * version of this file shelled out to the emitter instead — which rewrote every
 * app copy before the comparisons ran and healed the drift it was supposed to
 * catch. It passed against deliberately corrupted files. Never let a check
 * repair its own subject.
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

  it.each(destinations)('%s is byte-identical to the source', (destination) => {
    const path = join(REPO_ROOT, destination)

    // A sibling folder can legitimately be absent — they are gitignored by the
    // parent, so a fresh clone of ColorLab alone will not have them. Missing is
    // fine; present-but-different is not.
    if (!existsSync(path)) return

    expect(
      readFileSync(path, 'utf8'),
      `${destination} has drifted from the source — run \`npm run tokens:emit\``,
    ).toBe(canonical)
  })
})

describe('no app redefines a shared token', () => {
  /* Re-declaring one of these locally wins the cascade silently, which is the
     failure mode this whole package exists to prevent. */
  const OWNED = [
    '--color-void',
    '--color-base',
    '--color-raised',
    '--color-edge',
    '--color-ink',
    '--color-ink-muted',
    '--color-ink-faint',
    '--color-community',
    '--color-proposal',
    '--color-ai',
    '--color-danger',
    '--color-heart',
    '--radius-glass',
    '--breakpoint-3xl',
    '--breakpoint-4xl',
  ]

  /** Each app's own stylesheet — the one place a redeclaration would hide. */
  const APP_STYLESHEETS = [
    'src/app/globals.css',
    'sonylivesop-main/src/index.css',
    'cheese-booth-main/src/styles/tokens.css',
  ]

  it.each(APP_STYLESHEETS)('%s declares none of them', (stylesheet) => {
    const path = join(REPO_ROOT, stylesheet)
    if (!existsSync(path)) return

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

describe('every app imports the shared files', () => {
  const IMPORTERS: ReadonlyArray<[string, readonly string[]]> = [
    ['src/app/globals.css', ['theme.css', 'primitives.css', 'vfx.css']],
    ['sonylivesop-main/src/index.css', ['theme.css', 'primitives.css', 'vfx.css']],
    [
      'cheese-booth-main/src/styles/tokens.css',
      ['tokens.css', 'primitives.css', 'vfx.css'],
    ],
  ]

  it.each(IMPORTERS)('%s imports %s', (stylesheet, expectedImports) => {
    const path = join(REPO_ROOT, stylesheet)
    if (!existsSync(path)) return

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

/**
 * Pure generation of the shared CSS artefacts. No filesystem writes.
 *
 * Split from emit.ts so the drift test can compute what the files *should*
 * contain without running the emitter — an earlier version of that test shelled
 * out to the emitter first, which rewrote every app copy and healed the very
 * drift it was meant to catch. A test that repairs the thing it is checking
 * always passes.
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { COLOR_GROUPS, NAMESPACED_GROUPS, type TokenGroup } from './tokens'

const HERE = dirname(fileURLToPath(import.meta.url))

export const BANNER = [
  '/* GENERATED FILE — DO NOT EDIT.',
  ' *',
  ' * Source: packages/colorlab-tokens/src/tokens.ts',
  ' * Regenerate: npm run tokens:emit',
  ' *',
  ' * A drift test in each app fails if this file is edited by hand or falls',
  ' * behind the source, so an edit here is reverted by the next CI run at best',
  ' * and silently diverges the ecosystem at worst.',
  ' */',
  '',
].join('\n')

function block(group: TokenGroup, prefix: string, indent: string): string {
  const comment = group.comment
    .split('\n')
    .map((line) => `${indent}/* ${line} */`)
    .join('\n')
    // Collapse the per-line comment markers into one block for readability.
    .replace(/ \*\/\n\s*\/\* /g, '\n' + indent + '   ')

  const declarations = Object.entries(group.tokens)
    .map(([name, value]) => `${indent}--${prefix}-${name}: ${value};`)
    .join('\n')

  return `${comment}\n${declarations}`
}

function sections(): string[] {
  return [
    ...COLOR_GROUPS.map((group) => block(group, 'color', '  ')),
    ...NAMESPACED_GROUPS.map(({ namespace, group }) => block(group, namespace, '  ')),
  ]
}

/**
 * Every generated artefact, keyed by filename.
 *
 * Two flavours of the same tokens, because the consumers differ:
 *
 *   theme.css   Tailwind v4 (`@theme static`). ColorLab and Sony Live SOP.
 *   tokens.css  plain `:root` custom properties. CheeseBooth, no Tailwind.
 *
 * `@theme static`, not a bare `@theme`: Tailwind only emits a theme variable it
 * has seen a utility use, and several of these are read solely through `var()`
 * from hand-written CSS, which the scanner cannot see. Under a plain `@theme`,
 * `--color-proposal` was dropped from `:root` and ColorLab's proposal card
 * rendered with no accent at all.
 */
export function generate(): Record<string, string> {
  return {
    'theme.css': `${BANNER}\n@theme static {\n${sections().join('\n\n')}\n}\n`,
    'tokens.css': `${BANNER}\n:root {\n${sections().join('\n\n')}\n}\n`,
    'primitives.css': BANNER + readFileSync(join(HERE, 'primitives.css'), 'utf8'),
    'vfx.css': BANNER + readFileSync(join(HERE, 'vfx.css'), 'utf8'),
  }
}

/** Where each artefact lands, relative to the repo root. */
export const TARGETS: ReadonlyArray<{
  readonly file: string
  readonly destinations: readonly string[]
}> = [
  {
    file: 'theme.css',
    destinations: [
      'src/app/vendor/colorlab-tokens/theme.css',
      'sonylivesop-main/src/styles/colorlab-tokens/theme.css',
    ],
  },
  {
    file: 'tokens.css',
    destinations: ['cheese-booth-main/src/styles/colorlab-tokens/tokens.css'],
  },
  {
    file: 'primitives.css',
    destinations: [
      'src/app/vendor/colorlab-tokens/primitives.css',
      'sonylivesop-main/src/styles/colorlab-tokens/primitives.css',
      'cheese-booth-main/src/styles/colorlab-tokens/primitives.css',
    ],
  },
  {
    file: 'vfx.css',
    destinations: [
      'src/app/vendor/colorlab-tokens/vfx.css',
      'sonylivesop-main/src/styles/colorlab-tokens/vfx.css',
      'cheese-booth-main/src/styles/colorlab-tokens/vfx.css',
    ],
  },
]

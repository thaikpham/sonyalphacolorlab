/**
 * Writes the generated CSS artefacts into the package's dist/ and syncs them
 * into every app that consumes them.
 *
 * Run from the ColorLab repo root:  npm run tokens:emit
 *
 * All of the actual generation lives in generate.ts, which touches no files —
 * that separation is what lets token-drift.test.ts check the app copies without
 * overwriting them first.
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { generate, TARGETS } from './generate'

const HERE = dirname(fileURLToPath(import.meta.url))
const PACKAGE_ROOT = resolve(HERE, '..')
const REPO_ROOT = resolve(PACKAGE_ROOT, '..', '..')

function write(path: string, contents: string): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, contents, 'utf8')
}

const generated = generate()

// Keep a copy in the package so it is publishable as-is.
for (const [file, contents] of Object.entries(generated)) {
  write(join(PACKAGE_ROOT, 'dist', file), contents)
}

let count = 0
for (const { file, destinations } of TARGETS) {
  for (const destination of destinations) {
    write(join(REPO_ROOT, destination), generated[file])
    console.log(`  ${destination}`)
    count += 1
  }
}

console.log(
  `\ncolorlab-tokens: emitted ${Object.keys(generated).length} files, synced ${count} copies.`,
)

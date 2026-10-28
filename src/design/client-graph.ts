import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'

/**
 * The static import graph of the browser bundle, as far as this repo's own
 * files go. A client component's value imports are what Turbopack puts in its
 * chunk; `import type` and `export type` erase, and so does an import whose
 * every name is marked `type`. Bare specifiers end the walk: only the ones
 * asked about are reported. A dynamic `import()` is not followed: it is its
 * own chunk, fetched when the code runs, which is the right way for a client
 * to reach a server library on a rare path (the proposal form's settings check
 * loads the recipe schema on submit, not with the page).
 */
const EXTENSIONS = ['.ts', '.tsx', '/index.ts', '/index.tsx']

export function importsOf(source: string): string[] {
  const out: string[] = []
  // The clause is only what an import clause can hold (names, braces, commas,
  // `*`, `as`), so `export type A = 1` cannot run on into the next statement.
  const statement = /(?:^|\n)\s*(import|export)\s+(type\s+)?([\w$*{},\s]*?)\s*from\s*['"]([^'"]+)['"]/g
  for (const m of source.matchAll(statement)) {
    if (m[2]) continue
    const names = m[3].trim()
    if (names.startsWith('{') && names.endsWith('}')) {
      const parts = names.slice(1, -1).split(',').map((p) => p.trim()).filter(Boolean)
      if (parts.length && parts.every((p) => p.startsWith('type '))) continue
    }
    out.push(m[4])
  }
  for (const m of source.matchAll(/(?:^|\n)\s*import\s*['"]([^'"]+)['"]/g)) out.push(m[1])
  return [...new Set(out)]
}

function directive(source: string): string | null {
  const code = source.replace(/^(?:\s*(?:\/\/[^\n]*|\/\*[\s\S]*?\*\/))*\s*/, '')
  return /^['"](use (?:client|server))['"]/.exec(code)?.[1] ?? null
}

const isClient = (source: string) => directive(source) === 'use client'
/** A 'use server' module reaches the client bundle only as references to its
    exported functions; nothing it imports ships, so the walk stops there. */
const isServerFunctions = (source: string) => directive(source) === 'use server'

function resolveLocal(root: string, from: string, spec: string): string | null {
  const base = spec.startsWith('@/') ? join(root, 'src', spec.slice(2)) : spec.startsWith('.') ? join(dirname(from), spec) : null
  if (base === null) return null
  if (existsSync(base) && statSync(base).isFile()) return base
  for (const ext of EXTENSIONS) if (existsSync(base + ext)) return base + ext
  return null
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name)
    if (e.isDirectory()) return e.name === 'node_modules' || e.name.startsWith('.') ? [] : sourceFiles(p)
    return /\.tsx?$/.test(e.name) && !/\.(test|spec)\.tsx?$/.test(e.name) ? [p] : []
  })
}

/** Every chain from a 'use client' file under `root/src` to a forbidden package, shortest first per entry. */
export function clientChains(root: string, forbidden: string[]): string[][] {
  const hits = (spec: string) => forbidden.some((f) => spec === f || spec.startsWith(`${f}/`))
  const chains: string[][] = []
  for (const entry of sourceFiles(join(root, 'src'))) {
    if (!isClient(readFileSync(entry, 'utf8'))) continue
    const seen = new Set<string>([entry])
    const queue: string[][] = [[entry]]
    while (queue.length) {
      const path = queue.shift()!
      const file = path[path.length - 1]
      for (const spec of importsOf(readFileSync(file, 'utf8'))) {
        if (hits(spec)) {
          chains.push([...path.map((p) => relative(root, p)), spec])
          queue.length = 0
          break
        }
        const next = resolveLocal(root, file, spec)
        if (next && !seen.has(next) && !isServerFunctions(readFileSync(next, 'utf8'))) {
          seen.add(next)
          queue.push([...path, next])
        }
      }
    }
  }
  return chains.sort((a, b) => a[0].localeCompare(b[0]))
}

# Zod out of the browser — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop shipping zod (63 KB gz) to the browser on `/cameras`, `/audio`, `/blog`, `/learn`, keep it out with a test, and add security headers.

**Architecture:** Client components reach zod through two value imports of constants that live beside zod schemas. Move the schema (search) or the constants (recipe ids) so the modules client code imports are zod-free; a static import-graph walker from every `'use client'` file fails the unit suite if `zod` is reachable again. Headers are one exported list used by `next.config.ts`.

**Tech Stack:** Next 16 App Router (Turbopack), TypeScript, vitest, Playwright gates (`npm run test:screens`).

Spec: `docs/superpowers/specs/2026-10-28-perf-client-zod-design.md`.

## Global Constraints

- Branch `claude/perf-client-zod`, repo `/home/thaikpham/Desktop/ColorLab 2.0`. Commit on top of HEAD; no rebase/amend/worktree.
- `.env.local` holds LIVE Supabase credentials. Never `next start`/`next build` with them except `npm run verify`; never `push:*`, `content:import`, `supabase:migrations --apply`. Never `rm -rf .next` (only `.next/dev`). Never start `next dev` through Bash.
- `npm test`, `npm run typecheck`, `npm run lint` (check `echo $?`, never pipe lint) before each commit.
- Budgets only go down; a lowered number carries the date `2026-10-28` and the measurement.
- Do not edit `CLAUDE.md`. No user-visible strings are added.
- Commit trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

### Task 1: The guard, and the two paths it finds

**Files:**
- Create: `src/design/client-graph.ts`
- Create: `src/design/client-graph.test.ts`
- Create: `src/lib/camera/ids.ts`
- Create: `src/lib/search/request.ts`
- Modify: `src/lib/camera/schema.ts:170-190` (regexes move out, re-exported)
- Modify: `src/lib/lab/meta.ts:16` (import from `ids.ts`)
- Modify: `src/lib/search/types.ts` (schema moves out; file becomes zod-free)
- Modify: `src/lib/search/service.ts`, `src/lib/search/service.test.ts`, `src/app/api/search/route.ts` (import the schema from `request.ts`)

**Interfaces:**
- Produces: `clientChains(root: string, forbidden: string[]): string[][]` — every import chain (file paths relative to `root`, ending in the bare specifier) from a `'use client'` file under `root/src` to a forbidden package; `importsOf(source: string): string[]` — value-import specifiers of one file. `src/lib/camera/ids.ts` exports `RECIPE_ID_RE`, `RECIPE_ID_TRANSITION_RE`, `RECIPE_TAG_RE`. `src/lib/search/request.ts` exports `searchRequestSchema`, `ParsedSearchRequest`.

- [ ] **Step 1: Write the walker's probes (fixture, no repo)**

`src/design/client-graph.test.ts`:

```ts
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { REPO_ROOT } from './floor'
import { clientChains, importsOf } from './client-graph'

/**
 * Zod is a server library here: it validates requests, rows and model output.
 * It reached the browser twice — 63 KB gz on /cameras, /audio, /blog and
 * /learn (measured 2026-10-28) — through a client component importing one
 * constant that lived beside a schema. This walks the static import graph
 * from every 'use client' file and names the chain.
 */
function fixture(files: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), 'client-graph-'))
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(join(root, path, '..'), { recursive: true })
    writeFileSync(join(root, path), body)
  }
  return root
}

describe('importsOf', () => {
  it('keeps value imports and re-exports, drops type-only ones', () => {
    const src = [
      "import { a } from './a'",
      "import type { B } from './b'",
      "import { type C, type D } from './c'",
      "import { type E, f } from './e'",
      "import './side-effect'",
      "export { g } from './g'",
      "export type { H } from './h'",
      "export * from './star'",
      "const lazy = () => import('./lazy')",
      "import {\n  m,\n  n,\n} from './multi'",
      'export type Alias = { a: 1 }',
      "import { after } from './after-type-alias'",
    ].join('\n')
    expect(importsOf(src).sort()).toEqual(['./a', './after-type-alias', './e', './g', './lazy', './multi', './side-effect', './star'])
  })
})

describe('clientChains', () => {
  it('finds zod through an @/ alias and a relative hop, and names the chain', () => {
    const root = fixture({
      'src/components/view.tsx': "'use client'\nimport { MAX } from '@/lib/types'\n",
      'src/lib/types.ts': "import { z } from 'zod'\nexport const MAX = 1\n",
      'src/components/other.tsx': "\"use client\";\nimport { x } from './helper'\n",
      'src/components/helper.ts': "export { y as x } from '../lib/deep/index'\n",
      'src/lib/deep/index.ts': "import 'zod/v4'\n",
    })
    expect(clientChains(root, ['zod'])).toEqual([
      ['src/components/other.tsx', 'src/components/helper.ts', 'src/lib/deep/index.ts', 'zod/v4'],
      ['src/components/view.tsx', 'src/lib/types.ts', 'zod'],
    ])
  })

  it('ignores server files, type-only imports and a comment above the directive', () => {
    const root = fixture({
      'src/server.ts': "import { z } from 'zod'\n",
      'src/a.tsx': "// a note\n'use client'\nimport type { Z } from './schema'\nimport { ok } from './clean'\n",
      'src/schema.ts': "import { z } from 'zod'\nexport type Z = 1\n",
      'src/clean.ts': 'export const ok = 1\n',
    })
    expect(clientChains(root, ['zod'])).toEqual([])
  })
})

describe('the repository', () => {
  it('ships no zod to the browser', () => {
    expect(clientChains(REPO_ROOT, ['zod'])).toEqual([])
  })
})
```

- [ ] **Step 2: Run, expect RED**

Run: `npx vitest run src/design/client-graph.test.ts`
Expected: FAIL — cannot resolve `./client-graph`.

- [ ] **Step 3: Implement the walker**

`src/design/client-graph.ts`:

```ts
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'

/**
 * The static import graph of the browser bundle, as far as this repo's own
 * files go. A client component's value imports are what Turbopack puts in its
 * chunk; `import type` and `export type` erase, and so does an import whose
 * every name is marked `type`. Bare specifiers end the walk: only the ones
 * asked about are reported.
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
  for (const m of source.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)) out.push(m[1])
  return [...new Set(out)]
}

function isClient(source: string): boolean {
  const code = source.replace(/^(?:\s*(?:\/\/[^\n]*|\/\*[\s\S]*?\*\/))*\s*/, '')
  return /^['"]use client['"]/.test(code)
}

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
        if (next && !seen.has(next)) {
          seen.add(next)
          queue.push([...path, next])
        }
      }
    }
  }
  return chains.sort((a, b) => a[0].localeCompare(b[0]))
}
```

- [ ] **Step 4: Run, expect the probes GREEN and the repository RED**

Run: `npx vitest run src/design/client-graph.test.ts`
Expected: `importsOf` and both `clientChains` probes pass; `ships no zod to the browser` FAILS listing chains, including one ending `src/lib/search/types.ts, zod` (via `src/components/camera-wiki-view.tsx`) and one ending `src/lib/camera/schema.ts, zod` (via `src/components/lab/feed-admin-row.tsx` → `src/lib/lab/articles.ts` → `src/lib/lab/meta.ts`). Paste the full list into the report. If a probe fails, fix the walker, not the probe.

- [ ] **Step 5: Move the recipe id regexes to a zod-free module**

Create `src/lib/camera/ids.ts` holding the three exports cut verbatim (doc comments included) from `src/lib/camera/schema.ts` — `RECIPE_ID_RE`, `RECIPE_ID_TRANSITION_RE`, `RECIPE_TAG_RE` — with this header:

```ts
/**
 * Recipe id and tag shapes, apart from the zod schema so client code can read
 * them without shipping zod (src/design/client-graph.test.ts). `schema.ts`
 * re-exports them; `sql-drift.test.ts` still pins RECIPE_ID_RE to the CHECK.
 */
```

In `schema.ts`, where they were:

```ts
import { RECIPE_ID_RE, RECIPE_ID_TRANSITION_RE, RECIPE_TAG_RE } from './ids';
export { RECIPE_ID_RE, RECIPE_ID_TRANSITION_RE, RECIPE_TAG_RE };
```

(put the `import` with the file's other imports). In `src/lib/lab/meta.ts:16` change the import to `from '@/lib/camera/ids'`.

- [ ] **Step 6: Move the search request schema out of `types.ts`**

Create `src/lib/search/request.ts` with `import { z } from 'zod'`, the needed constants imported from `./types` (`SEARCH_SCOPES`, `MAX_LIMIT`, `DEFAULT_LIMIT`, `MAX_OFFSET`, `MAX_QUERY` — whichever the schema uses), and `searchRequestSchema` + `ParsedSearchRequest` cut verbatim from `types.ts` with their comments. Remove `import { z } from 'zod'` from `types.ts`. Update the imports in `src/lib/search/service.ts`, `src/lib/search/service.test.ts` and `src/app/api/search/route.ts` to take `searchRequestSchema` / `ParsedSearchRequest` from `@/lib/search/request` (or `./request`).

- [ ] **Step 7: Run the guard; fix any further chain the same way**

Run: `npx vitest run src/design/client-graph.test.ts`
Expected: PASS. If another chain remains, move the constant the client needs into a zod-free module beside its schema and re-export it from the schema file — never move a schema into client code, never add an exemption. Record each extra chain and its fix in the report.

- [ ] **Step 8: Full suite, typecheck, lint; commit**

Run: `npm test`, `npm run typecheck`, `npm run lint; echo $?` — all exit 0.

```bash
git add src/design/client-graph.ts src/design/client-graph.test.ts src/lib/camera/ids.ts src/lib/camera/schema.ts src/lib/lab/meta.ts src/lib/search/request.ts src/lib/search/types.ts src/lib/search/service.ts src/lib/search/service.test.ts src/app/api/search/route.ts
git commit -m "Zod stays on the server: id shapes and search limits in zod-free modules, and a guard over the client import graph"
```

---

### Task 2: Security headers

**Files:**
- Create: `src/lib/security-headers.ts`
- Create: `src/lib/security-headers.test.ts`
- Modify: `next.config.ts` (add `headers()` beside `redirects()`)

**Interfaces:**
- Produces: `SECURITY_HEADERS: readonly { key: string; value: string }[]`.

- [ ] **Step 1: Write the failing test**

`src/lib/security-headers.test.ts`:

```ts
import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { SECURITY_HEADERS } from './security-headers'

describe('security headers', () => {
  it('are exactly the agreed five, no CSP', () => {
    expect(Object.fromEntries(SECURITY_HEADERS.map((h) => [h.key, h.value]))).toEqual({
      'Strict-Transport-Security': 'max-age=63072000; includeSubDomains',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      'X-Frame-Options': 'DENY',
    })
  })

  it('are served on every path by next.config.ts', () => {
    const config = readFileSync('next.config.ts', 'utf8')
    expect(config).toMatch(/async headers\(\)\s*\{[\s\S]*source:\s*'\/:path\*'[\s\S]*headers:\s*\[\.\.\.SECURITY_HEADERS\]/)
  })
})
```

- [ ] **Step 2: Run, expect RED**

Run: `npx vitest run src/lib/security-headers.test.ts`
Expected: FAIL — cannot resolve `./security-headers`.

- [ ] **Step 3: Implement**

`src/lib/security-headers.ts`:

```ts
/**
 * Sent on every response (next.config.ts `headers()`). No Content-Security-
 * Policy: a wrong one breaks pages without an error anyone sees, so it is its
 * own piece of work. X-Frame-Options DENY: nothing frames this site, and the
 * blog's own embeds are frames of other sites, which this does not govern.
 */
export const SECURITY_HEADERS: readonly { key: string; value: string }[] = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'X-Frame-Options', value: 'DENY' },
]
```

In `next.config.ts`, import it (`import { SECURITY_HEADERS } from './src/lib/security-headers';` — match how the file already imports `legacyRedirects`) and add after `redirects()`:

```ts
  async headers() {
    return [{ source: '/:path*', headers: [...SECURITY_HEADERS] }];
  },
```

- [ ] **Step 4: Run, expect GREEN; full suite, typecheck, lint**

Run: `npx vitest run src/lib/security-headers.test.ts` → PASS; then `npm test`, `npm run typecheck`, `npm run lint; echo $?` → all 0.

- [ ] **Step 5: Commit**

```bash
git add src/lib/security-headers.ts src/lib/security-headers.test.ts next.config.ts
git commit -m "Security headers on every response, no CSP yet"
```

---

### Task 3: Re-measure and lower the JS budgets

**Files:**
- Modify: `e2e/perf.spec.ts` (`SCREENS` budgets and the dated comment above it)

- [ ] **Step 1: Run the gates**

Run: `npm run test:screens` (timeout 600000, foreground). If port 3100 is busy, report the process and use `SCREENS_PORT=3101` for that run only.
Expected: PASS (budgets are ceilings), and the perf table prints `/cameras`, `/audio`, `/blog`, `/learn` well under their old 250/250/247/247. Paste the whole table into the report.

- [ ] **Step 2: Lower every budget the run came in under**

Set each `SCREENS` entry to the printed KB (already rounded up by the spec) for every screen whose number dropped — at least the four above; leave any screen that did not drop. Append to the comment above `SCREENS`:

```
 * Re-measured 2026-10-28 after zod left the client bundle (src/design/
 * client-graph.test.ts): /cameras A, /audio B, /blog C, /learn D KB, from
 * 250/250/247/247 — zod was 63 KB gz of each.
```

with A–D the measured numbers (and any other screen that dropped).

- [ ] **Step 3: Run the gates again on the lowered budgets**

Run: `npm run test:screens` → EXIT 0. Then `npm test`, `npm run typecheck`, `npm run lint; echo $?` → all 0; `git status --short` shows only `e2e/perf.spec.ts`.

- [ ] **Step 4: Commit**

```bash
git add e2e/perf.spec.ts
git commit -m "Perf budgets: /cameras, /audio, /blog, /learn lowered after zod left the browser"
```

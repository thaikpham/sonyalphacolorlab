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
  it('keeps static value imports and re-exports, drops type-only and dynamic ones', () => {
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
    expect(importsOf(src).sort()).toEqual(['./a', './after-type-alias', './e', './g', './multi', './side-effect', './star'])
  })
})

describe('clientChains', () => {
  it('does not follow a dynamic import: its chunk loads on demand, not with the page', () => {
    const root = fixture({
      'src/form.tsx': "'use client'\nasync function submit() {\n  const { schema } = await import('./schema')\n}\n",
      'src/schema.ts': "import { z } from 'zod'\nexport const schema = z.string()\n",
    })
    expect(clientChains(root, ['zod'])).toEqual([])
  })

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

  it("stops at a 'use server' module, whose imports never ship, and not at a 'use client' one", () => {
    const root = fixture({
      'src/picker.tsx': "'use client'\nimport { choose } from './action'\nimport { Inner } from './inner'\n",
      'src/action.ts': "'use server';\nimport { z } from 'zod'\nexport async function choose() {}\n",
      'src/inner.tsx': "'use client'\nimport { z } from 'zod'\nexport const Inner = 1\n",
    })
    expect(clientChains(root, ['zod'])).toEqual([
      ['src/inner.tsx', 'zod'],
      ['src/picker.tsx', 'src/inner.tsx', 'zod'],
    ])
  })
})

describe('the repository', () => {
  it('ships no zod to the browser', () => {
    expect(clientChains(REPO_ROOT, ['zod'])).toEqual([])
  })
})

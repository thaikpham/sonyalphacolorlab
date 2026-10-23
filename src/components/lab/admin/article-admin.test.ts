import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * The article editor's wiring, read from its source.
 *
 * What lands on the draft is executed in `article-draft.test.ts`; this file
 * pins that the component actually goes through those functions, and the
 * ordering a static render cannot show. Source assertions because the suite
 * has no DOM — the same call `admin-editor.test.ts` makes for the product
 * editor. Each handler is sliced out so a match in one cannot pass for
 * another.
 */

const source = readFileSync('src/components/lab/admin/article-admin.tsx', 'utf8')
const blocks = readFileSync('src/components/lab/admin/block-editor.tsx', 'utf8')

/** The source with comments removed, so prose never reads as code. */
const strip = (s: string) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
const code = strip(source)

/** One function's body, from its declaration to the next one at that depth. */
function fn(name: string, src = code): string {
  const start = src.search(new RegExp(`\\n  (async )?function ${name}\\(`))
  expect(start, name).toBeGreaterThan(-1)
  const rest = src.slice(start + 1)
  const next = rest.search(/\n {2}(async function|function|const|return \()/)
  return next === -1 ? rest : rest.slice(0, next)
}

describe('saving', () => {
  it('holds the list and the new-article button still while a request is out', () => {
    expect(code).toMatch(/onClick=\{startNew\}\s*disabled=\{busy !== ''\}/)
    expect(code).toMatch(/onClick=\{\(\) => openArticle\(a\.id\)\}\s*disabled=\{busy !== ''\}/)
  })

  it('will not publish an article with a blank title', () => {
    expect(code).toMatch(
      /save\(draft\.status === 'published' \? 'draft' : 'published'\)\}\s*disabled=\{busy !== '' \|\| !draft\.title\.trim\(\)\}/,
    )
  })
})

describe('opening', () => {
  it('asks about unsaved changes on the click, and only there', () => {
    expect(fn('openArticle')).toMatch(/dirty && !window\.confirm\(t\('discardConfirm'\)\)/)
  })
})

describe('what the editor reports', () => {
  it('shows the status line with or without an open article', () => {
    /* "Article deleted" was set after the draft was cleared, inside a branch
       that only renders with a draft — so it never appeared. */
    const statusAt = code.indexOf('role="status"')
    expect(statusAt).toBeGreaterThan(-1)
    expect(statusAt).toBeLessThan(code.indexOf('{!draft ? ('))
  })

  it('says the list is empty only after it has loaded, and says why it did not', () => {
    expect(code).toMatch(/listError \? \([\s\S]{0,160}codeMessage\(listError\)/)
    expect(code).toMatch(/listLoaded && visible\.length === 0/)
  })
})

describe('blocks', () => {
  it('keys each block by identity, not by position', () => {
    expect(code).toMatch(/<section key=\{key\}/)
    expect(code).not.toMatch(/key=\{i\}/)
  })

  it('merges an upload into the current block rather than writing back the one it picked from', () => {
    expect(code).toMatch(/onAsset=\{\(field, assetId\) => setAsset\(draft\.session, key, field, assetId\)\}/)
    expect(strip(blocks)).not.toMatch(/onChange\(\{ \.\.\.block, (before|after)?[aA]ssetId/)
  })

  it('takes a slot’s preview from the shared map alone', () => {
    expect(strip(blocks)).not.toMatch(/fresh/)
  })
})

describe('design', () => {
  it('borrows no signal colour for an editor notice', () => {
    /* Signals classify content and nothing else (CLAUDE.md). `community` tinted
       "needs both images" and "needs a video id", which are neither. */
    for (const file of ['article-admin.tsx', 'block-editor.tsx', 'meta-editor.tsx', 'use-article-editor.ts']) {
      const src = readFileSync(`src/components/lab/admin/${file}`, 'utf8')
      expect(src, file).not.toMatch(/(text|bg)-(community|proposal|ai)\b/)
    }
  })
})

describe('copy', () => {
  const messages = {
    en: JSON.parse(readFileSync('messages/en.json', 'utf8')).labAdmin,
    vi: JSON.parse(readFileSync('messages/vi.json', 'utf8')).labAdmin,
  }

  it('names the panel a refused metadata entry came from, not only its links and sources', () => {
    /* parseMeta also refuses an author name with an "@", a bad review date, a
       section, an order and entries past its caps — and the message used to
       send the editor checking links that were fine. */
    for (const locale of ['en', 'vi'] as const) {
      const m = messages[locale]
      expect(m.savedWithDroppedMeta, locale).toContain(m.metaHeading)
    }
  })
})

describe('one list of archetypes and link kinds', () => {
  it('offers exactly what the parser accepts, from the parser’s own list', async () => {
    /* Declared three times, a new archetype could compile, be offered, and
       answer every save 400 — or be accepted and never offered. */
    const { ARCHETYPES, parseArchetype } = await import('@/lib/lab/parse')
    const { REF_KINDS } = await import('@/lib/lab/meta')
    for (const a of ARCHETYPES) expect(parseArchetype(a)).toBe(a)

    const meta = readFileSync('src/components/lab/admin/meta-editor.tsx', 'utf8')
    expect(code).not.toMatch(/const ARCHETYPES/)
    expect(meta).not.toMatch(/const REF_KINDS/)
    expect(code).toMatch(/import \{[^}]*\bARCHETYPES\b[^}]*\} from '@\/lib\/lab\/parse'/)
    expect(meta).toMatch(/import \{[^}]*\bREF_KINDS\b[^}]*\} from '@\/lib\/lab\/meta'/)

    const labels = JSON.parse(readFileSync('messages/en.json', 'utf8')).labAdmin
    expect(Object.keys(labels.archetypes).sort()).toEqual([...ARCHETYPES].sort())
    expect(Object.keys(labels.relatedKinds).sort()).toEqual([...REF_KINDS].sort())
  })
})

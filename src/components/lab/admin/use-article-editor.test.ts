import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * `useArticleEditor()`'s wiring, read from its source.
 *
 * What lands on the draft is executed in `article-draft.test.ts`; this file
 * pins that the hook actually goes through those functions, and the ordering
 * a static render cannot show. Source assertions because the suite has no
 * DOM — the same call `editor.test.ts` makes for the page-shaped editor.
 * The list screen this hook once belonged to (`article-admin.tsx`) is gone
 * (an article is edited on its own page now); the assertions that still held
 * moved here with it.
 */

const source = readFileSync('src/components/lab/admin/use-article-editor.ts', 'utf8')
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
  const save = fn('save')

  it('applies the answer to the draft as it is now, not to the copy it sent', () => {
    expect(save).toMatch(/const sent = draft/)
    expect(save).toMatch(/setDraft\(\(d\) => afterSave\(d, sent, stored\)\)/)
    expect(save).not.toMatch(/setDraft\(\{\s*\.\.\.draft/)
    expect(code).not.toMatch(/setDirty/)
  })

  it('never reloads through the path that asks to discard changes', () => {
    expect(save).not.toMatch(/loadArticle\(|window\.confirm/)
  })
})

describe('opening', () => {
  it('drops an answer for an article the editor has since moved off', () => {
    const load = fn('loadArticle')
    expect(load).toMatch(/opening\.current = id/)
    expect(load.indexOf('opening.current !== id')).toBeLessThan(load.indexOf('setDraft('))
  })

  it('reports a failed read instead of throwing it away', () => {
    expect(fn('loadArticle')).toMatch(/catch \{[\s\S]*codeMessage\('loadFailed'\)/)
    expect(fn('remove')).toMatch(/catch \{[\s\S]*codeMessage\('deleteFailed'\)/)
  })

  it('never asks to discard changes itself — the caller does, before calling it', () => {
    expect(fn('loadArticle')).not.toMatch(/window\.confirm/)
  })
})

describe('what the editor reports', () => {
  it('computes the publish checklist from the draft on screen', () => {
    expect(code).toMatch(/publishProblems\(draft, unknownRefs\)/)
    expect(code).not.toMatch(/setProblems/)
  })
})

describe('blocks', () => {
  it('merges an upload into the current block rather than writing back the one it picked from', () => {
    expect(code).toMatch(/withAsset\(d, session, key, field, assetId\)/)
    expect(strip(blocks)).not.toMatch(/onChange\(\{ \.\.\.block, (before|after)?[aA]ssetId/)
  })

  it('takes a slot’s preview from the shared map alone', () => {
    expect(strip(blocks)).not.toMatch(/fresh/)
  })
})

describe('leaving', () => {
  it('asks before a client-side navigation, which beforeunload never sees', () => {
    expect(code).toMatch(/window\.addEventListener\('click', guard, true\)/)
    expect(code).toMatch(/leavesInPlace\(e, link\)/)
    expect(code).toMatch(/window\.addEventListener\('beforeunload', warn\)/)
  })
})

describe('inserting', () => {
  it('chooses the key before the update, so the caller can open the new block', () => {
    const insert = fn('insertAt')
    expect(insert).toMatch(/const key = nextKey\(\)/)
    expect(insert).toMatch(/insertBlock\(d, type, at, key\)/)
    expect(insert).toMatch(/return key/)
  })
})

describe('design', () => {
  it('borrows no signal colour for an editor notice', () => {
    /* Signals classify content and nothing else (CLAUDE.md). `community` tinted
       "needs both images" and "needs a video id", which are neither. */
    for (const file of [
      'src/components/lab/admin/block-editor.tsx',
      'src/components/lab/admin/meta-editor.tsx',
      'src/components/lab/admin/use-article-editor.ts',
      'src/components/lab/editor/article-editor.tsx',
      'src/components/lab/editor/editable-block.tsx',
      'src/components/lab/editor/editor-rail.tsx',
      'src/components/lab/editor/block-preview.tsx',
    ]) {
      const src = readFileSync(file, 'utf8')
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

    const rail = readFileSync('src/components/lab/editor/editor-rail.tsx', 'utf8')
    const meta = readFileSync('src/components/lab/admin/meta-editor.tsx', 'utf8')
    expect(rail).not.toMatch(/const ARCHETYPES/)
    expect(meta).not.toMatch(/const REF_KINDS/)
    expect(rail).toMatch(/import \{[^}]*\bARCHETYPES\b[^}]*\} from '@\/lib\/lab\/parse'/)
    expect(meta).toMatch(/import \{[^}]*\bREF_KINDS\b[^}]*\} from '@\/lib\/lab\/meta'/)

    const labels = JSON.parse(readFileSync('messages/en.json', 'utf8')).labAdmin
    expect(Object.keys(labels.archetypes).sort()).toEqual([...ARCHETYPES].sort())
    expect(Object.keys(labels.relatedKinds).sort()).toEqual([...REF_KINDS].sort())
  })
})

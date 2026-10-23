import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * `useArticleEditor()`'s wiring, read from its source.
 *
 * What lands on the draft is executed in `article-draft.test.ts`; this file
 * pins that the hook actually goes through those functions, and the ordering
 * a static render cannot show. Source assertions because the suite has no
 * DOM — the same call `article-admin.test.ts` makes for the list screen.
 * Moved here from `article-admin.test.ts` when the editor's data layer moved
 * into this hook; `article-admin.test.ts` keeps only what is still true about
 * the list screen's own rendering.
 */

const source = readFileSync('src/components/lab/admin/use-article-editor.ts', 'utf8')

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

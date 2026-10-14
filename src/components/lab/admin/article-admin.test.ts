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
  const save = fn('save')

  it('applies the answer to the draft as it is now, not to the copy it sent', () => {
    expect(save).toMatch(/const sent = draft/)
    expect(save).toMatch(/setDraft\(\(d\) => afterSave\(d, sent, stored\)\)/)
    expect(save).not.toMatch(/setDraft\(\{\s*\.\.\.draft/)
    expect(code).not.toMatch(/setDirty/)
  })

  it('never reloads through the path that asks to discard changes', () => {
    /* `openArticle` read `dirty` from the render that pressed Save, where it
       was true: the editor was asked to discard an article just saved. */
    expect(save).not.toMatch(/openArticle\(|loadArticle\(|window\.confirm/)
  })

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
    expect(fn('loadArticle')).not.toMatch(/window\.confirm/)
  })

  it('drops an answer for an article the editor has since moved off', () => {
    const load = fn('loadArticle')
    expect(load).toMatch(/opening\.current = id/)
    expect(load.indexOf('opening.current !== id')).toBeLessThan(load.indexOf('setDraft('))
  })

  it('reports a failed read instead of throwing it away', () => {
    expect(fn('loadArticle')).toMatch(/catch \{[\s\S]*codeMessage\('loadFailed'\)/)
    expect(fn('remove')).toMatch(/catch \{[\s\S]*codeMessage\('deleteFailed'\)/)
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

  it('computes the publish checklist from the draft on screen', () => {
    expect(code).toMatch(/publishProblems\(draft, unknownRefs\)/)
    expect(code).not.toMatch(/setProblems/)
  })
})

describe('blocks', () => {
  it('keys each block by identity, not by position', () => {
    expect(code).toMatch(/<section key=\{key\}/)
    expect(code).not.toMatch(/key=\{i\}/)
  })

  it('merges an upload into the current block rather than writing back the one it picked from', () => {
    expect(code).toMatch(/onAsset=\{\(field, assetId\) => setAsset\(draft\.session, key, field, assetId\)\}/)
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

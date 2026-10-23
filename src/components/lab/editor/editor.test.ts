import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/** The page-shaped editor's wiring, from its source (the suite has no DOM). */
const read = (f: string) => readFileSync(`src/components/lab/editor/${f}`, 'utf8')

describe('BlockPreview', () => {
  const src = read('block-preview.tsx')

  it('draws a block with the reader’s own renderers', () => {
    for (const c of ['TldrCard', 'Heading', 'Paragraph', 'MenuPair', 'ComparisonTable', 'Callout', 'ArticleEmbed']) {
      expect(src).toMatch(new RegExp(`<${c}[\\s/>]`))
    }
  })

  it('shows a draft’s pictures from the signed previews, never the public URL', () => {
    /* A draft's assets are in the private bucket; the public URL is a 404. */
    expect(src).toMatch(/previews\[/)
    expect(src).not.toMatch(/assetUrl\(/)
  })

  it('has a case for every block type', () => {
    expect(src).toMatch(/const unreachable: never = block/)
  })
})

describe('EditableBlock', () => {
  const src = read('editable-block.tsx')

  it('is the reader’s block when closed and its fields when open', () => {
    expect(src).toMatch(/open \? \(/)
    expect(src).toMatch(/<BlockFields/)
    expect(src).toMatch(/<BlockPreview/)
  })

  it('opens from a real button as well as from a click on the block', () => {
    expect(src).toMatch(/<button[\s\S]{0,200}onClick=\{onOpen\}/)
    expect(src).toMatch(/aria-expanded=\{open\}/)
  })

  it('closes on Escape', () => {
    expect(src).toMatch(/e\.key === 'Escape'/)
  })

  it('draws no stroke', () => {
    expect(src).not.toMatch(/\b(border|ring|outline)-/)
  })
})

describe('BlockInserter', () => {
  const src = read('block-inserter.tsx')

  it('offers every block type, in the editor’s order', () => {
    expect(src).toMatch(/BLOCK_TYPES\.map/)
  })

  it('stays visible on touch, where there is no hover', () => {
    expect(src).toMatch(/pointer-fine:opacity-0/)
    expect(src).toMatch(/focus-within:opacity-100/)
  })
})

describe('ArticleEditor', () => {
  const src = read('article-editor.tsx')

  it('opens the record it was given, or starts a page of the route’s kind', () => {
    expect(src).toMatch(/if \(id\) void editor\.loadArticle\(id\)/)
    expect(src).toMatch(/else editor\.startNew\(kind\)/)
  })

  it('moves to the page’s own edit URL once it has an id, or changes kind, without remounting', () => {
    expect(src).toMatch(/window\.history\.replaceState\(null, '', getPathname\(\{ href: `\$\{pathFor\(stored\.kind, stored\.id\)\}\/edit`, locale \}\)\)/)
  })

  it('compares the stored kind against the URL’s own ref, not the route prop, so a second kind change still moves it', () => {
    expect(src).toMatch(/const urlKind = useRef\(kind\)/)
    expect(src).toMatch(/stored\.kind !== urlKind\.current/)
    expect(src).toMatch(/urlKind\.current = stored\.kind/)
    expect(src).not.toMatch(/stored\.kind !== kind/)
  })

  it('keeps one block open at a time, and opens a block as it is inserted', () => {
    expect(src).toMatch(/const \[openKey, setOpenKey\] = useState<number \| null>\(null\)/)
    expect(src).toMatch(/setOpenKey\(editor\.insertBlock\(type, 0\)\)/)
    expect(src).toMatch(/setOpenKey\(editor\.insertBlock\(type, i \+ 1\)\)/)
  })

  it('keys blocks by identity', () => {
    expect(src).toMatch(/key=\{key\}/)
    expect(src).not.toMatch(/key=\{i\}/)
  })

  it('merges an upload into the block as it is now', () => {
    expect(src).toMatch(/editor\.setAsset\(draft\.session, key, field, assetId\)/)
  })

  it('reads the same column measure as the published page', () => {
    expect(src).toMatch(/max-w-\[46rem\] flex-1 basis-\[32\.5rem\]/)
  })
})

describe('EditorRail', () => {
  const src = read('editor-rail.tsx')

  it('says what saving is doing, politely, as a status', () => {
    expect(src).toMatch(/aria-live="polite"/)
    expect(src).toMatch(/t\('savedAt'/)
    expect(src).toMatch(/t\('unsaved'\)/)
  })

  it('decides dirty before an ok message, so an edit after a save is not hidden behind "Saved"', () => {
    const dirtyIndex = src.search(/dirty\s*\?/)
    const okIndex = src.search(/status\?\.kind === 'ok'/)
    expect(dirtyIndex).toBeGreaterThan(-1)
    expect(okIndex).toBeGreaterThan(-1)
    expect(dirtyIndex).toBeLessThan(okIndex)
  })

  it('shows the publish rules the whole time', () => {
    expect(src).toMatch(/editor\.problems\.length === 0 \? t\('specClear'\)/)
  })

  it('will not save or publish a page with a blank title', () => {
    expect(src.match(/disabled=\{busy !== '' \|\| !draft\.title\.trim\(\)\}/g)?.length).toBe(2)
  })

  it('keeps the bottom bar out of any animated parent and pays back the safe area', () => {
    expect(src).toMatch(/fixed inset-x-0 bottom-0 z-30 pb-safe lg:hidden/)
    expect(src).not.toMatch(/animate-fade-in/)
  })

  it('locks the kind of a published page, as the route does', () => {
    expect(src).toMatch(/disabled=\{draft\.status === 'published'\}/)
  })
})

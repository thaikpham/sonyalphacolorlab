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

import { describe, expect, it } from 'vitest'
import { ARTICLES } from '@/lib/lab/articles'
import { firstSentence, llmsTxt } from './llms'

const input = {
  site: 'https://site.test',
  knowledge: [{ ...ARTICLES[0], id: 'k1', kind: 'knowledge' as const, title: 'Kiến thức 1', dek: 'Sapo k1.' }],
  articles: [{ ...ARTICLES[0], id: 'a1', title: 'Bài 1', dek: 'Sapo a1.' }],
  recipes: [{ name: 'PP-001-Vivid Film', slug: 'pp-001-vivid-film', description: 'Warm and punchy. For street.' }],
  cameras: [{ id: 'sony-ilce-7m4', name: 'α7 IV' }],
  audio: [{ id: 'sony-wh-1000xm5', name: 'WH-1000XM5' }],
}
const out = llmsTxt(input)

describe('llmsTxt', () => {
  it('follows the llms.txt shape: title, summary, then sections in order', () => {
    expect(out.startsWith('# Alpha ColorLab\n\n> ')).toBe(true)
    const order = ['## Learn', '## Blog', '## Recipes', '## Cameras & lenses', '## Audio', '## Hubs'].map((h) => out.indexOf(h))
    expect(order.every((i) => i > 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
  })

  it('links pages to their .md twins, recipes and products to their pages', () => {
    expect(out).toContain('- [Kiến thức 1](https://site.test/vi/learn/k1.md): Sapo k1.')
    expect(out).toContain('- [Bài 1](https://site.test/vi/blog/a1.md): Sapo a1.')
    expect(out).toContain('- [PP-001-Vivid Film](https://site.test/recipe/pp-001-vivid-film): Warm and punchy.')
    expect(out).toContain('- [α7 IV](https://site.test/cameras/sony-ilce-7m4)')
    expect(out).toContain('- [WH-1000XM5](https://site.test/audio/sony-wh-1000xm5)')
  })

  it('has one line per item', () => {
    expect(out.match(/^- \[/gm)).toHaveLength(5 + 7)
  })
})

describe('firstSentence', () => {
  it('stops at the first full stop followed by a space or the end', () => {
    expect(firstSentence('One. Two.')).toBe('One.')
    expect(firstSentence('f/2.8 is wide. Next.')).toBe('f/2.8 is wide.')
    expect(firstSentence('No stop')).toBe('No stop')
  })
})

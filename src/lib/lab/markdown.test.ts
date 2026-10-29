import { describe, expect, it } from 'vitest'
import type { Article, Block } from './types'
import { ARTICLES } from './articles'
import { articleMarkdown, plainText } from './markdown'

/** One of every block type, so a renderer that forgets one fails here. */
const blocks: Block[] = [
  { t: 'tldr', items: ['Một', 'Hai', 'Ba'] },
  { t: 'p', text: 'Đoạn mở đầu.' },
  { t: 'h', text: 'Cài đặt' },
  { t: 'menu', old: 'MENU → A → B', new: 'MENU → C → D' },
  { t: 'table', head: ['Cột 1', 'Cột 2', 'Cột | 3'], rows: [['a', 'b', 'c']], caption: 'Bảng ví dụ' },
  { t: 'callout', label: 'Lưu ý', text: 'Nội dung lưu ý.' },
  { t: 'compare', beforeLabel: 'Trước', afterLabel: 'Sau', caption: 'Hai ảnh' },
  { t: 'checklist', label: 'Việc cần làm', items: ['Bước một', 'Bước hai'] },
  { t: 'figure', caption: 'Một bức ảnh', assetId: '00000000-0000-0000-0000-000000000000' } as Block,
  { t: 'embed', provider: 'youtube', id: 'abc123', caption: 'Video hướng dẫn' },
  { t: 'embed', provider: 'vimeo', id: '76979871', caption: 'Video khác' },
]
const article: Article = {
  ...ARTICLES[0],
  id: 'fixture',
  title: 'Tiêu đề',
  dek: 'Sapo ngắn.',
  blocks,
  meta: {
    ...ARTICLES[0].meta,
    sources: [{ url: 'https://helpguide.sony.net/x', title: 'Picture Profile', publisher: 'Sony', checkedAt: '2026-10-29' }],
  },
}
const md = articleMarkdown(article, { canonicalUrl: 'https://site.test/vi/blog/fixture' })

describe('articleMarkdown', () => {
  it('opens with the title, the dek and the canonical URL', () => {
    expect(md.startsWith('# Tiêu đề\n\nSapo ngắn.\n\nNguồn gốc: https://site.test/vi/blog/fixture\n')).toBe(true)
  })

  it('renders every block type', () => {
    expect(md).toContain('> Một\n> Hai\n> Ba')
    expect(md).toContain('Đoạn mở đầu.')
    expect(md).toContain('## Cài đặt')
    expect(md).toContain('- Cũ: MENU → A → B\n- Mới: MENU → C → D')
    expect(md).toContain('| Cột 1 | Cột 2 | Cột \\| 3 |\n| --- | --- | --- |\n| a | b | c |')
    expect(md).toContain('*Bảng ví dụ*')
    expect(md).toContain('> **Lưu ý** Nội dung lưu ý.')
    expect(md).toContain('*So sánh ảnh: Trước / Sau — Hai ảnh*')
    expect(md).toContain('**Việc cần làm**\n\n- [ ] Bước một\n- [ ] Bước hai')
    expect(md).toContain('*Hình: Một bức ảnh*')
    expect(md).toContain('[Video hướng dẫn](https://www.youtube.com/watch?v=abc123)')
    expect(md).toContain('[Video khác](https://vimeo.com/76979871)')
  })

  it('closes with the dated sources', () => {
    expect(md.trimEnd().endsWith('## Nguồn\n\n- [Picture Profile](https://helpguide.sony.net/x) — Sony, 2026-10-29')).toBe(true)
  })

  it('keeps a paragraph that starts with a Markdown marker from being misread', () => {
    const p = articleMarkdown({ ...article, blocks: [{ t: 'p', text: '# không phải tiêu đề' }] }, { canonicalUrl: 'u' })
    expect(p).toContain('\\# không phải tiêu đề')
    const n = articleMarkdown({ ...article, blocks: [{ t: 'p', text: '1. không phải danh sách' }] }, { canonicalUrl: 'u' })
    expect(n).toContain('1\\. không phải danh sách')
  })
})

describe('plainText', () => {
  it('is the words a reader sees, without Markdown', () => {
    expect(plainText({ t: 'menu', old: 'MENU → A', new: 'MENU → B' })).toBe('MENU → A MENU → B')
    expect(plainText({ t: 'tldr', items: ['a', 'b', 'c'] })).toBe('a b c')
    expect(plainText({ t: 'embed', provider: 'youtube', id: 'x', caption: 'cap' })).toBe('cap')
  })
})

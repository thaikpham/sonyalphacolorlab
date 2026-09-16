import { describe, expect, it } from 'vitest'
import {
  parseBlock,
  parseBlocks,
  parseEmbedUrl,
  slugify,
  validateArticleShape,
} from './parse'
import type { Article, Block } from './types'

/**
 * `article-spec.test.ts` guards what a developer writes into the catalogue.
 * This file guards what an editor saves into Supabase — the same rules, on the
 * other side of the boundary, where the compiler cannot see them.
 *
 * The cases that matter most are the refusals. A `jsonb` column returns
 * whatever was written to it, and every renderer downstream of here trusts the
 * union in `types.ts` absolutely: a `tldr` with two items would crash the rail
 * mid-render, and a `figure` pointing anywhere but at an asset this project
 * owns would make the article hotlink a stranger's server with a caption under
 * it.
 *
 * That last class of bug is now closed by shape rather than by inspection. A
 * figure stores an asset UUID; there is no field a URL could go in.
 */

const ASSET = '3f2b9c41-6d5e-4a7b-9c10-2e8f4a6b1d33'
const OTHER_ASSET = '8a1c0e22-4b7d-4f19-ae03-91d6c5b7f402'

describe('parseEmbedUrl', () => {
  it.each([
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'youtube', 'dQw4w9WgXcQ'],
    ['https://youtu.be/dQw4w9WgXcQ', 'youtube', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/shorts/dQw4w9WgXcQ', 'youtube', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/embed/dQw4w9WgXcQ', 'youtube', 'dQw4w9WgXcQ'],
    ['https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=42s', 'youtube', 'dQw4w9WgXcQ'],
    ['https://vimeo.com/76979871', 'vimeo', '76979871'],
    ['https://player.vimeo.com/video/76979871', 'vimeo', '76979871'],
    ['dQw4w9WgXcQ', 'youtube', 'dQw4w9WgXcQ'],
    ['76979871', 'vimeo', '76979871'],
  ])('%s → %s %s', (input, provider, id) => {
    expect(parseEmbedUrl(input)).toEqual({ provider, id })
  })

  it('drops everything the watch URL carried but the id', () => {
    // A playlist, a start offset and a campaign tag, all handed to a third
    // party on the reader's behalf if the URL were stored whole.
    const parsed = parseEmbedUrl(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL9tY&t=90&utm_source=x',
    )
    expect(parsed).toEqual({ provider: 'youtube', id: 'dQw4w9WgXcQ' })
  })

  it('drops the hash of an unlisted Vimeo link rather than storing it', () => {
    expect(parseEmbedUrl('https://vimeo.com/76979871/abc123def4')).toEqual({
      provider: 'vimeo',
      id: '76979871',
    })
  })

  it.each([
    // The whole reason the host is matched after `new URL()` rather than by a
    // substring test: both of these contain "youtube.com".
    'https://evil.test/?next=youtube.com/watch?v=dQw4w9WgXcQ',
    'https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ',
    'https://vimeo.com/not-a-number',
    'https://www.dailymotion.com/video/x8abcde',
    'https://www.youtube.com/watch?v=short',
    'not a url at all',
    '',
  ])('refuses %s', (input) => {
    expect(parseEmbedUrl(input)).toBeNull()
  })
})

describe('an image reference', () => {
  it('is an asset UUID, and the block keeps it', () => {
    expect(parseBlock({ t: 'figure', caption: 'c', assetId: ASSET })).toEqual({
      t: 'figure',
      caption: 'c',
      alt: undefined,
      assetId: ASSET,
    })
  })

  it('folds case, because a path segment is built from it', () => {
    expect(parseBlock({ t: 'figure', caption: 'c', assetId: ASSET.toUpperCase() })).toMatchObject({
      assetId: ASSET,
    })
  })

  it.each([
    ['a legacy absolute Storage URL', 'https://nqeedlgzaewccqztqvik.supabase.co/storage/v1/object/public/lab/a.jpg'],
    ['a root-relative path', '/lab/2026-09/a.jpg'],
    ['a protocol-relative URL', '//evil.test/pixel.png'],
    ['a third party', 'https://evil.test/pixel.png'],
    ['a javascript scheme', 'javascript:alert(1)'],
    ['a path traversal', '../../../etc/passwd'],
    ['a near-miss UUID', '3f2b9c41-6d5e-4a7b-9c10-2e8f4a6b1d3'],
    ['a nil UUID, whose version nibble is zero', '00000000-0000-0000-0000-000000000000'],
  ])('drops %s rather than storing it', (_label, value) => {
    /* Dropped, not carried. A legacy URL names the old project, and writing it
       back would put a host-coupled URL into a *new* row — the exact coupling
       the UUID exists to remove. Real legacy URLs are resolved to assets by the
       migration script before the import, not here. */
    expect(parseBlock({ t: 'figure', caption: 'c', assetId: value })).toMatchObject({
      assetId: undefined,
    })
  })

  it('keeps the two halves of a comparison independent', () => {
    expect(
      parseBlock({
        t: 'compare',
        beforeLabel: 'PP Off',
        afterLabel: 'S-Cinetone',
        caption: 'c',
        beforeAssetId: ASSET,
        afterAssetId: OTHER_ASSET,
      }),
    ).toMatchObject({ beforeAssetId: ASSET, afterAssetId: OTHER_ASSET })

    expect(
      parseBlock({
        t: 'compare',
        beforeLabel: 'PP Off',
        afterLabel: 'S-Cinetone',
        caption: 'c',
        beforeAssetId: ASSET,
        afterAssetId: 'https://evil.test/after.png',
      }),
    ).toMatchObject({ beforeAssetId: ASSET, afterAssetId: undefined })
  })
})

describe('parseBlock', () => {
  it('refuses a TL;DR that is not exactly three lines', () => {
    expect(parseBlock({ t: 'tldr', items: ['a', 'b'] })).toBeNull()
    expect(parseBlock({ t: 'tldr', items: ['a', 'b', 'c', 'd'] })).toBeNull()
    expect(parseBlock({ t: 'tldr', items: ['a', 'b', 'c'] })).toEqual({
      t: 'tldr',
      items: ['a', 'b', 'c'],
    })
  })

  it('refuses half a menu pair', () => {
    expect(parseBlock({ t: 'menu', old: 'MENU → X', new: '' })).toBeNull()
  })

  it('keeps a table at three columns and drops a row with no header cell', () => {
    const parsed = parseBlock({
      t: 'table',
      head: ['a', 'b', 'c'],
      caption: 'Measured indoors.',
      rows: [
        ['x', 'y', 'z'],
        ['', 'y', 'z'],
        ['w', 'v'],
        ['q', 'r', 's', 't'],
      ],
    })
    // The second row has no row header, the third and fourth are not triples.
    expect(parsed).toEqual({
      t: 'table',
      head: ['a', 'b', 'c'],
      caption: 'Measured indoors.',
      rows: [['x', 'y', 'z']],
    })
  })

  it('keeps an empty middle cell, which is a legitimate "not applicable"', () => {
    const parsed = parseBlock({
      t: 'table',
      head: ['a', 'b', 'c'],
      caption: 'x',
      rows: [['row', '', 'z']],
    })
    expect(parsed).toMatchObject({ rows: [['row', '', 'z']] })
  })

  it('refuses an embed whose id is not the shape its provider issues', () => {
    expect(parseBlock({ t: 'embed', provider: 'youtube', id: '76979871', caption: 'x' })).toBeNull()
    expect(parseBlock({ t: 'embed', provider: 'vimeo', id: 'dQw4w9WgXcQ', caption: 'x' })).toBeNull()
    expect(parseBlock({ t: 'embed', provider: 'twitch', id: 'abc', caption: 'x' })).toBeNull()
  })

  it('no longer carries an animated flag for a GIF to ride in on', () => {
    /* A GIF bypassed the optimizer and was served whole, so a 40 MB screen
       recording was one drag-and-drop away. Uploads are re-encoded to three
       bounded WebP rungs now, and animation is refused by a CHECK constraint
       on `lab_assets` — a flag here would be a way around it. */
    expect(parseBlock({ t: 'figure', caption: 'c', animated: true })).toEqual({
      t: 'figure',
      caption: 'c',
      alt: undefined,
      assetId: undefined,
    })
  })

  it('rebuilds the block rather than passing extra keys through', () => {
    const parsed = parseBlock({ t: 'p', text: 'hello', onClick: 'alert(1)' })
    expect(parsed).toEqual({ t: 'p', text: 'hello' })
  })

  it.each([
    null,
    'a string',
    ['an', 'array'],
    { t: 'video', src: 'x' },
    { t: 'p', text: '   ' },
  ])('refuses %s', (input) => {
    expect(parseBlock(input)).toBeNull()
  })
})

describe('parseBlocks', () => {
  it('drops what it cannot trust and counts it', () => {
    const { blocks, dropped } = parseBlocks([
      { t: 'p', text: 'kept' },
      { t: 'tldr', items: ['a'] },
      'nonsense',
      { t: 'h', text: 'kept too' },
    ])
    expect(blocks.map((b) => b.t)).toEqual(['p', 'h'])
    expect(dropped).toBe(2)
  })

  it('treats a non-array column as an empty body', () => {
    expect(parseBlocks(null)).toEqual({ blocks: [], dropped: 0 })
    expect(parseBlocks({ 0: { t: 'p', text: 'x' } })).toEqual({ blocks: [], dropped: 0 })
  })
})

describe('slugify', () => {
  it.each([
    ['ST hay PT: chọn Creative Look nào', 'st-hay-pt-chon-creative-look-nao'],
    ['Đặt ISO Auto và Min. SS', 'dat-iso-auto-va-min-ss'],
    ['   spaced   out   ', 'spaced-out'],
  ])('%s → %s', (title, expected) => {
    expect(slugify(title)).toBe(expected)
  })

  it('never ends on the separator, even when the 60-char cut lands on one', () => {
    const slug = slugify('a'.repeat(58) + ' b c d e f g')
    expect(slug.endsWith('-')).toBe(false)
  })
})

describe('validateArticleShape', () => {
  const block = (t: Block['t'], i: number): Block => {
    switch (t) {
      case 'tldr':
        return { t: 'tldr', items: ['a', 'b', 'c'] }
      case 'h':
        return { t: 'h', text: `Heading ${i}` }
      case 'checklist':
        return { t: 'checklist', label: 'Check', items: ['a', 'b', 'c'] }
      default:
        return { t: 'p', text: `Paragraph ${i}` }
    }
  }

  /* A minimal article that satisfies every countable rule: TL;DR, context
     paragraph, then alternating headings and paragraphs, closing on a
     checklist. Each test below breaks exactly one thing about it. */
  const valid: Article = {
    id: 'x',
    topic: 'setup',
    level: 'newbie',
    archetype: 'explainer',
    read: '5 phút đọc',
    title: 'Title',
    dek: 'Dek.',
    blocks: [
      block('tldr', 0),
      block('p', 1),
      block('h', 2),
      block('p', 3),
      block('h', 4),
      block('p', 5),
      block('h', 6),
      block('checklist', 7),
    ],
  }

  it('passes an article that satisfies every countable rule', () => {
    expect(validateArticleShape(valid)).toEqual([])
  })

  it('refuses an article that is too short to be one', () => {
    expect(validateArticleShape({ ...valid, blocks: valid.blocks.slice(0, 4) })).toContain(
      'tooFewBlocks',
    )
  })

  it('refuses an article that does not open on the TL;DR', () => {
    expect(validateArticleShape({ ...valid, blocks: valid.blocks.slice(1) })).toContain(
      'mustOpenWithTldr',
    )
  })

  it('refuses an article that trails off in a paragraph', () => {
    const blocks = [...valid.blocks.slice(0, 7), block('p', 7)]
    expect(validateArticleShape({ ...valid, blocks })).toContain(
      'mustCloseWithChecklistOrFigure',
    )
  })

  it('refuses two blocks of one type back to back, but allows a run of menu pairs', () => {
    const repeated = [...valid.blocks]
    repeated.splice(3, 0, block('p', 99))
    expect(validateArticleShape({ ...valid, blocks: repeated })).toContain('repeatedBlock')

    const menus: Block[] = [
      valid.blocks[0],
      valid.blocks[1],
      { t: 'h', text: 'Two paths' },
      { t: 'menu', old: 'MENU → A', new: 'MENU → B' },
      { t: 'menu', old: 'MENU → C', new: 'MENU → D' },
      block('p', 5),
      block('h', 6),
      block('checklist', 7),
    ]
    expect(validateArticleShape({ ...valid, blocks: menus })).toEqual([])
  })

  it('refuses a comparison labelled "before" and "after"', () => {
    const blocks: Block[] = [
      ...valid.blocks.slice(0, 5),
      { t: 'compare', beforeLabel: 'Before', afterLabel: 'After', caption: 'c' },
      block('h', 6),
      block('checklist', 7),
    ]
    expect(validateArticleShape({ ...valid, blocks })).toContain('compareLabels')
  })

  it('refuses emoji and exclamation marks anywhere in the article', () => {
    const problems = validateArticleShape({
      ...valid,
      title: 'Tuyệt vời!',
      dek: 'Xem ngay ✨',
    })
    expect(problems).toContain('exclamation')
    expect(problems).toContain('emoji')
  })
})

import { describe, expect, it } from 'vitest'
import { EMPTY_META, META_LIMITS, parseAuthorName, parseIsoDate, parseMeta, parseSourceUrl } from './meta'

/**
 * `meta` reaches a public page and the anon API (ADR 0002), so it is parsed
 * with the same suspicion as `blocks`: rebuilt from validated pieces, with
 * every refusal counted so the editor is told.
 */

describe('parseMeta', () => {
  it('returns empty metadata for a pre-migration row', () => {
    expect(parseMeta(undefined)).toEqual({ meta: EMPTY_META, dropped: 0 })
    expect(parseMeta(null)).toEqual({ meta: EMPTY_META, dropped: 0 })
    expect(parseMeta({})).toEqual({ meta: EMPTY_META, dropped: 0 })
  })

  it('counts a value that is not an object as one drop', () => {
    expect(parseMeta('nonsense')).toEqual({ meta: EMPTY_META, dropped: 1 })
    expect(parseMeta([])).toEqual({ meta: EMPTY_META, dropped: 1 })
  })

  it('keeps well-formed references by real id and drops the rest', () => {
    const { meta, dropped } = parseMeta({
      related: [
        { kind: 'recipe', id: 'SCL-PP-001' },
        { kind: 'recipe', id: 'mojave-sun' }, // a slug, not the recipe's id
        { kind: 'product', id: 'sony-ilce-7m4-bq-ap2' },
        { kind: 'article', id: 'iso-auto-min-ss' },
        { kind: 'knowledge', id: 'white-balance-shift' },
        { kind: 'article', id: 'https://evil.test/x' },
        { kind: 'video', id: 'x' },
        { kind: 'recipe', id: 'SCL-PP-001' }, // duplicate
        'SCL-PP-002',
      ],
    })
    expect(meta.related).toEqual([
      { kind: 'recipe', id: 'SCL-PP-001' },
      { kind: 'product', id: 'sony-ilce-7m4-bq-ap2' },
      { kind: 'article', id: 'iso-auto-min-ss' },
      { kind: 'knowledge', id: 'white-balance-shift' },
    ])
    expect(dropped).toBe(5)
  })

  it('rebuilds each reference, so a stray key never survives', () => {
    const { meta } = parseMeta({
      related: [{ kind: 'recipe', id: 'SCL-CL-003', onclick: 'alert(1)' }],
    })
    expect(meta.related[0]).toEqual({ kind: 'recipe', id: 'SCL-CL-003' })
  })

  it('bounds every list', () => {
    const many = Array.from({ length: META_LIMITS.related + 5 }, (_, i) => ({
      kind: 'recipe',
      id: `SCL-PP-${String(i + 1).padStart(3, '0')}`,
    }))
    const { meta, dropped } = parseMeta({ related: many })
    expect(meta.related).toHaveLength(META_LIMITS.related)
    expect(dropped).toBe(5)
  })

  it('keeps only concepts the app has', () => {
    const { meta, dropped } = parseMeta({ concepts: ['pp.colorDepth', 'wb.shiftAb', 'pp.lutStrength'] })
    expect(meta.concepts).toEqual(['pp.colorDepth', 'wb.shiftAb'])
    expect(dropped).toBe(1)
  })

  it('keeps sources with an https URL and a title, with optional fields cleaned', () => {
    const { meta, dropped } = parseMeta({
      sources: [
        {
          url: 'https://helpguide.sony.net/di/pp/v1/en/contents/TP0000909111.html',
          title: '  Picture Profile —   Color Depth ',
          publisher: 'Sony',
          checkedAt: '2026-10-05',
          scope: 'ILCE-7M4',
          extra: 'dropped key',
        },
        { url: 'http://example.com/plain-http', title: 'Plain HTTP' },
        { url: 'javascript:alert(1)', title: 'Script' },
        { url: 'https://user:pass@example.com/', title: 'Credentials' },
        { url: 'https://example.com/no-title' },
        { url: 'https://example.com/bad-date', title: 'Bad date', checkedAt: '2026-02-31' },
      ],
    })
    expect(meta.sources).toEqual([
      {
        url: 'https://helpguide.sony.net/di/pp/v1/en/contents/TP0000909111.html',
        title: 'Picture Profile — Color Depth',
        publisher: 'Sony',
        checkedAt: '2026-10-05',
        scope: 'ILCE-7M4',
      },
      /* An impossible date is dropped from the source, not the whole source:
         the link is still good, and publishing a knowledge page will then
         refuse it for having no checked date. */
      { url: 'https://example.com/bad-date', title: 'Bad date' },
    ])
    expect(dropped).toBe(4)
  })

  it('never accepts an address as the public author name', () => {
    expect(parseAuthorName('Thái Phạm')).toBe('Thái Phạm')
    expect(parseAuthorName('editor@example.com')).toBeNull()
    const { meta, dropped } = parseMeta({ authorName: 'editor@example.com' })
    expect(meta.authorName).toBeNull()
    expect(dropped).toBe(1)
  })

  it('validates scalar fields and counts the bad ones', () => {
    const { meta, dropped } = parseMeta({
      reviewedAt: '2026-10-05',
      section: 'sony-color',
      order: 3,
    })
    expect(meta).toMatchObject({ reviewedAt: '2026-10-05', section: 'sony-color', order: 3 })
    expect(dropped).toBe(0)

    const bad = parseMeta({ reviewedAt: 'yesterday', section: 'glossary', order: -1 })
    expect(bad.meta).toMatchObject({ reviewedAt: null, section: null, order: null })
    expect(bad.dropped).toBe(3)
  })

  it('treats an empty scalar as unset, not as an error', () => {
    expect(parseMeta({ authorName: '', reviewedAt: '', section: '' }).dropped).toBe(0)
  })
})

describe('parseIsoDate', () => {
  it.each(['2026-10-05', '2024-02-29'])('accepts %s', (d) => {
    expect(parseIsoDate(d)).toBe(d)
  })
  it.each(['2026-13-01', '2025-02-29', '05/10/2026', '2026-1-5', ''])('refuses %s', (d) => {
    expect(parseIsoDate(d)).toBeNull()
  })
})

describe('parseSourceUrl', () => {
  it('normalises a valid https URL', () => {
    expect(parseSourceUrl(' https://Example.com/a b ')).toBe('https://example.com/a%20b')
  })
  it.each(['ftp://example.com', 'https://localhost/x', '/relative', 'https://'])('refuses %s', (u) => {
    expect(parseSourceUrl(u)).toBeNull()
  })
})

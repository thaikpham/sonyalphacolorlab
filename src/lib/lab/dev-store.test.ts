import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { ARTICLES } from './articles'

/**
 * The article dev store before its first write.
 *
 * With no file yet, every read seeds from the compiled catalogue. The seed's
 * `updatedAt` is the version the editor sends back on save, so it has to be the
 * same on every read: stamped with the clock, GET handed out one version, the
 * PATCH re-read a later one, and every save of a seeded article was refused as
 * stale — and reopening it fetched yet another.
 *
 * The store resolves its file from `process.cwd()` at import, so the suite
 * points that at a scratch directory before importing anything.
 */

const root = mkdtempSync(join(tmpdir(), 'colorlab-lab-dev-store-'))
mkdirSync(join(root, 'data'))
const FILE = join(root, 'data', 'lab-articles.dev.json')

vi.spyOn(process, 'cwd').mockReturnValue(root)
vi.stubEnv('NODE_ENV', 'development')
vi.mock('@/lib/supabase/server', () => ({
  hasContentConfig: () => false,
  hasControlConfig: () => false,
  contentRead: () => {
    throw new Error('offline')
  },
  contentAdmin: () => {
    throw new Error('offline')
  },
}))

const store = await import('./admin-store')

afterAll(() => {
  vi.unstubAllEnvs()
  rmSync(root, { recursive: true, force: true })
})

beforeEach(() => {
  rmSync(FILE, { force: true })
})

const seeded = ARTICLES[0]

describe('the seeded article dev store', () => {
  it('hands out the same version on every read until the first write', async () => {
    const first = await store.getArticleRecord(seeded.id)
    await new Promise((resolve) => setTimeout(resolve, 5))
    const second = await store.getArticleRecord(seeded.id)

    expect(first?.updatedAt).toBeTruthy()
    expect(second?.updatedAt).toBe(first?.updatedAt)
    expect(existsSync(FILE)).toBe(false)
  })

  it('saves a seeded article over the version it was opened at', async () => {
    const opened = await store.getArticleRecord(seeded.id)
    if (!opened) throw new Error('seeded article missing')
    await new Promise((resolve) => setTimeout(resolve, 5))

    const { status: _status, updatedAt, updatedBy: _by, ...article } = opened
    const next = await store.updateArticleRecord(
      { ...article, title: `${article.title} (edited)` },
      'published',
      'admin@example.test',
      updatedAt,
    )

    const stored = await store.getArticleRecord(seeded.id)
    expect(stored?.title).toBe(`${article.title} (edited)`)
    expect(stored?.updatedAt).toBe(next)
    expect(next).not.toBe(updatedAt)
  })

  it('still refuses a seeded article saved over a version it never had', async () => {
    const opened = await store.getArticleRecord(seeded.id)
    if (!opened) throw new Error('seeded article missing')
    const { status: _status, updatedAt: _v, updatedBy: _by, ...article } = opened

    await expect(
      store.updateArticleRecord(article, 'published', 'admin@example.test', '2000-01-01T00:00:00.000Z'),
    ).rejects.toBeInstanceOf(store.StaleEditError)
    expect(existsSync(FILE)).toBe(false)
  })
})

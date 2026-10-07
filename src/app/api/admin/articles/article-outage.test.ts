import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * What the article route answers when the content project stops answering —
 * executed, not pattern-matched.
 *
 * Two shapes of the same mistake. The asset ledger read in `asset-lifecycle`
 * throws on a PostgREST error, and none of the route's three call sites caught
 * it: an unpublish that had already flipped the row answered a JSON-less 500,
 * the editor's `res.json()` failed, and they were told a save had failed that
 * had in fact gone through. And `getArticleRecord` answered `null` for an
 * error as well as for a missing row, so opening any article during an outage
 * said it no longer existed — the outage-as-absence conflation that
 * `admin-gate.ts` and `existence.ts` were written to prevent.
 *
 * The content client is a fake whose `lab_articles` and `lab_assets` reads can
 * each be made to fail the way a restricted project fails.
 */

const ID = 'body-ev-vs-flash-ev'

const db = {
  articleError: null as { message: string } | null,
  assetsError: null as { message: string } | null,
  article: null as Record<string, unknown> | null,
}

vi.mock('@/lib/supabase/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/supabase/server')>()),
  hasContentConfig: () => true,
  contentAdmin: () => ({
    from: (table: string) => {
      if (table === 'lab_assets') {
        return {
          select: () => ({ eq: async () => ({ data: null, error: db.assetsError }) }),
        }
      }
      expect(table).toBe('lab_articles')
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: db.articleError ? null : db.article, error: db.articleError }),
          }),
        }),
        update: () => ({ eq: () => ({ select: async () => ({ data: [{ id: ID }], error: null }) }) }),
        delete: () => ({ eq: async () => ({ error: null }) }),
      }
    },
  }),
}))

vi.mock('@/lib/lab/dev-store', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/lab/dev-store')>()),
  isDevStore: () => false,
}))

vi.mock('@/lib/auth/admin-gate', () => ({
  adminGate: async () => ({
    ok: true,
    admin: { id: 'u1', email: 'editor@example.com', name: 'Editor', avatarUrl: null, assuranceLevel: 'aal2', role: 'super' },
  }),
}))

vi.mock('@/lib/lab/reference-check', () => ({ findUnknownReferences: async () => [] }))
vi.mock('@/lib/lab/asset-store', () => ({ articlePreviews: async () => ({}) }))

/* The editorial rules are not what is under test, and a body that satisfies
   them runs to eight blocks. Waived so a publish reaches the asset step. */
vi.mock('@/lib/lab/parse', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/lab/parse')>()),
  validateForPublish: () => [],
}))

const { GET, PATCH, DELETE } = await import('./[id]/route')

const ctx = { params: Promise.resolve({ id: ID }) }
const url = `http://localhost/api/admin/articles/${ID}`

const draftBody = {
  title: 'Body EV vs flash EV',
  topic: 'setup',
  level: 'newbie',
  archetype: 'explainer',
  blocks: [],
  status: 'draft',
}

beforeEach(() => {
  db.articleError = null
  db.assetsError = null
  db.article = { id: ID, title: 'Body EV vs flash EV', status: 'published', kind: 'article', blocks: [] }
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('GET', () => {
  it('answers loadFailed, not notFound, when the content project errors', async () => {
    db.articleError = { message: 'Payment Required' }
    const res = await GET(new Request(url), ctx)
    expect(res.status).toBe(502)
    expect(await res.json()).toEqual({ error: 'loadFailed' })
  })

  it('still answers notFound for a row that is genuinely gone', async () => {
    db.article = null
    const res = await GET(new Request(url), ctx)
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'notFound' })
  })
})

describe('PATCH', () => {
  const patch = (body: unknown) =>
    PATCH(new Request(url, { method: 'PATCH', body: JSON.stringify(body) }), ctx)

  it('answers assetSyncFailed as JSON when the ledger read fails on unpublish', async () => {
    db.assetsError = { message: 'Payment Required' }
    const res = await patch(draftBody)
    expect(res.status).toBe(502)
    expect(await res.json()).toMatchObject({ error: 'assetSyncFailed' })
  })

  it('answers assetSyncFailed as JSON when the ledger read fails on publish', async () => {
    db.assetsError = { message: 'Payment Required' }
    /* A figure is what makes the publish path read the ledger at all; with no
       referenced asset there is nothing to own. */
    const res = await patch({
      ...draftBody,
      status: 'published',
      blocks: [{ t: 'figure', assetId: '3f2b9c41-6d5e-4a7b-9c10-2e8f4a6b1d33', caption: 'Flash EV' }],
    })
    expect(res.status).toBe(502)
    expect(await res.json()).toEqual({ error: 'assetSyncFailed' })
  })

  it('falls through a failed kind-lock lookup rather than answering 500', async () => {
    db.articleError = { message: 'Payment Required' }
    const res = await patch(draftBody)
    expect(res.status).toBe(200)
  })
})

describe('DELETE', () => {
  it('answers assetSyncFailed as JSON when the ledger read fails', async () => {
    db.assetsError = { message: 'Payment Required' }
    const res = await DELETE(new Request(url, { method: 'DELETE' }), ctx)
    expect(res.status).toBe(502)
    expect(await res.json()).toEqual({ error: 'assetSyncFailed' })
  })
})

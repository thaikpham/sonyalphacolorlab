import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PILOT_DRAFTS } from '@/lib/lab/pilot-drafts'
import { PLACEHOLDER_MARK } from '@/lib/lab/parse'

/**
 * What the article write routes store and refuse — executed, with the real
 * parser and the real publish rules.
 *
 * `article-outage.test.ts` waives `validateForPublish` to reach the asset step
 * and `content-lifecycle.test.ts` reads the source, so until this file nothing
 * ran the publish gate, the forced draft on create or the version check. The
 * content client is a fake that records every write and every Storage call.
 */

const ID = 'body-ev-vs-flash-ev'
const OPENED = '2026-10-14T01:00:00.000001+00:00'
const SAVED = '2026-10-14T02:00:00.000002+00:00'

type Filter = [string, unknown]

const db = {
  /** The `lab_articles` row as a read sees it, or null for no row. */
  row: null as Record<string, unknown> | null,
  /** The version the update's filter is compared with. Differs from the read
      when another save lands between the route's read and its write. */
  writeVersion: null as string | null,
  updates: [] as { patch: Record<string, unknown>; filters: Filter[] }[],
  inserts: [] as Record<string, unknown>[],
  storage: [] as string[],
  assetReads: 0,
}

function articles() {
  return {
    select: () => ({
      eq: (_col: string, id: unknown) => ({
        maybeSingle: async () => ({
          data: db.row && db.row.id === id ? db.row : null,
          error: null,
        }),
      }),
    }),
    update: (patch: Record<string, unknown>) => {
      const filters: Filter[] = []
      const chain = {
        eq: (col: string, value: unknown) => {
          filters.push([col, value])
          return chain
        },
        select: async () => {
          db.updates.push({ patch, filters })
          const version = db.writeVersion ?? db.row?.updated_at
          const hit =
            db.row !== null &&
            filters.every(([col, value]) =>
              col === 'updated_at' ? value === version : db.row?.[col] === value,
            )
          return { data: hit ? [{ id: ID, updated_at: SAVED }] : [], error: null }
        },
      }
      return chain
    },
    insert: (row: Record<string, unknown>) => {
      db.inserts.push(row)
      return {
        select: () => ({ single: async () => ({ data: { updated_at: SAVED }, error: null }) }),
      }
    },
  }
}

vi.mock('@/lib/supabase/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/supabase/server')>()),
  hasContentConfig: () => true,
  contentAdmin: () => ({
    from: (table: string) => {
      if (table === 'lab_assets') {
        db.assetReads += 1
        return { select: () => ({ eq: async () => ({ data: [], error: null }) }) }
      }
      expect(table).toBe('lab_articles')
      return articles()
    },
    storage: {
      from: (bucket: string) => ({
        copy: async () => {
          db.storage.push(`copy:${bucket}`)
          return { error: null }
        },
        remove: async () => {
          db.storage.push(`remove:${bucket}`)
          return { error: null }
        },
      }),
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

const { PATCH } = await import('./[id]/route')
const { POST } = await import('./route')

const ctx = { params: Promise.resolve({ id: ID }) }
const url = `http://localhost/api/admin/articles/${ID}`

const patch = (body: unknown) =>
  PATCH(new Request(url, { method: 'PATCH', body: JSON.stringify(body) }), ctx)
const post = (body: unknown) =>
  POST(new Request('http://localhost/api/admin/articles', { method: 'POST', body: JSON.stringify(body) }))

const draftBody = {
  title: 'Body EV vs flash EV',
  kind: 'article',
  topic: 'setup',
  level: 'newbie',
  archetype: 'explainer',
  blocks: [],
  status: 'draft',
  expectedUpdatedAt: OPENED,
}

beforeEach(() => {
  db.row = {
    id: ID,
    title: 'Body EV vs flash EV',
    status: 'draft',
    kind: 'article',
    topic: 'setup',
    level: 'newbie',
    archetype: 'explainer',
    blocks: [],
    updated_at: OPENED,
  }
  db.writeVersion = null
  db.updates = []
  db.inserts = []
  db.storage = []
  db.assetReads = 0
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('PATCH — the version the editor opened', () => {
  it('refuses a row saved since then with 409 staleEdit, writing and moving nothing', async () => {
    db.row = { ...db.row, updated_at: SAVED }
    const res = await patch({ ...draftBody, status: 'published' })
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'staleEdit' })
    expect(db.updates).toEqual([])
    expect(db.assetReads).toBe(0)
    expect(db.storage).toEqual([])
  })

  it('names the version in the update, so a save landing after the read is refused too', async () => {
    db.writeVersion = SAVED
    const res = await patch(draftBody)
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'staleEdit' })
    expect(db.updates[0].filters).toContainEqual(['updated_at', OPENED])
  })

  it('still answers notFound for a row that is genuinely gone', async () => {
    db.row = null
    const res = await patch(draftBody)
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'notFound' })
  })

  it('refuses a body that names no version', async () => {
    const { expectedUpdatedAt: _omit, ...unversioned } = draftBody
    const res = await patch(unversioned)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'badRequest' })
    expect(db.updates).toEqual([])
  })

  it('answers the stored version and the stored article, as normalised', async () => {
    /* The parser cuts a TL;DR line at 140 characters without counting it as a
       drop. The editor rebuilds its screen from this answer, so what it shows
       after a save is what was stored, not what was typed. */
    const long = 'x'.repeat(160)
    const res = await patch({
      ...draftBody,
      title: `  ${draftBody.title}  `,
      blocks: [{ t: 'tldr', items: [long, 'two', 'three'] }],
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.updatedAt).toBe(SAVED)
    expect(data.article.title).toBe(draftBody.title)
    expect(data.article.status).toBe('draft')
    expect(data.article.blocks[0].items[0]).toHaveLength(140)
    expect(data.dropped).toBe(0)
  })
})

describe('PATCH — the title', () => {
  it('answers titleRequired for a blank title, not a bad topic or level', async () => {
    const res = await patch({ ...draftBody, title: '   ', status: 'published' })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'titleRequired' })
    expect(db.updates).toEqual([])
  })
})

describe('PATCH — the publish gate', () => {
  const frame = PILOT_DRAFTS.find(
    (a) => a.kind === 'article' && JSON.stringify(a.blocks).includes(PLACEHOLDER_MARK),
  )

  it('refuses a pilot frame still carrying placeholders, before any copy or update', async () => {
    expect(frame).toBeDefined()
    const res = await patch({ ...frame, status: 'published', expectedUpdatedAt: OPENED })
    expect(res.status).toBe(422)
    const data = await res.json()
    expect(data.error).toBe('specViolation')
    expect(data.problems).toEqual(['placeholder'])
    expect(db.updates).toEqual([])
    expect(db.storage).toEqual([])
  })
})

describe('POST', () => {
  it('creates a draft whatever status the body asked for', async () => {
    db.row = null
    const res = await post({ ...draftBody, status: 'published' })
    expect(res.status).toBe(200)
    expect(db.inserts).toHaveLength(1)
    expect(db.inserts[0].status).toBe('draft')
    const data = await res.json()
    expect(data.article.status).toBe('draft')
    expect(data.updatedAt).toBe(SAVED)
  })

  it('answers titleRequired for a blank title, writing nothing', async () => {
    const res = await post({ ...draftBody, title: ' ' })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'titleRequired' })
    expect(db.inserts).toEqual([])
  })

  it('never takes a reserved slug', async () => {
    db.row = null
    const res = await post({ ...draftBody, title: 'Admin' })
    expect(res.status).toBe(200)
    expect((await res.json()).id).toBe('admin-2')
    expect(db.inserts[0].id).toBe('admin-2')
  })
})

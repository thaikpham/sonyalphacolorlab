import { describe, expect, it, vi } from 'vitest'

/**
 * What the link picker's id list carries: ids and display names, and nothing
 * the picker does not read.
 *
 * `published`, `category` and `status` used to ride along. Nothing in the
 * editor read them, and the route's own header promised "ids and display
 * names only" — a field nobody reads is a field nobody notices widening.
 */

vi.mock('@/lib/supabase/server', () => ({ hasContentConfig: () => true }))
vi.mock('@/lib/lab/dev-store', () => ({ isDevStore: () => false }))
vi.mock('@/lib/auth/admin-gate', () => ({
  adminGate: async () => ({ ok: true, admin: { email: 'editor@example.com', role: 'super' } }),
}))
vi.mock('@/lib/recipes/admin-store', () => ({
  listRecipeRecords: async () => [
    { recipe: { id: 'scl-001', name: 'Mojave Sun', published: false, format: 'pp' } },
  ],
}))
vi.mock('@/lib/cameras/data', () => ({
  getSonyCameras: async () => [
    { id: 'a7-iv', name: 'Alpha 7 IV', sku: 'ILCE-7M4 / Body', category: 'camera' },
  ],
}))
vi.mock('@/lib/audio/data', () => ({
  getSonyAudio: async () => [{ id: 'wh-1000xm6', name: 'WH-1000XM6', sku: 'WH1000XM6', category: 'audio' }],
}))
vi.mock('@/lib/lab/admin-store', () => ({
  listArticleRecords: async () => [
    { id: 'white-balance-shift', title: 'White Balance Shift', kind: 'knowledge', status: 'draft', blocks: [] },
  ],
}))

const { GET } = await import('./route')

describe('GET /api/admin/content-refs', () => {
  it('answers ids and display names only', async () => {
    const res = await GET(new Request('http://localhost/api/admin/content-refs'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      recipes: [{ id: 'scl-001', name: 'Mojave Sun' }],
      products: [
        { id: 'a7-iv', name: 'Alpha 7 IV', code: 'ILCE-7M4' },
        { id: 'wh-1000xm6', name: 'WH-1000XM6', code: 'WH1000XM6' },
      ],
      pages: [{ id: 'white-balance-shift', title: 'White Balance Shift', kind: 'knowledge' }],
    })
  })
})

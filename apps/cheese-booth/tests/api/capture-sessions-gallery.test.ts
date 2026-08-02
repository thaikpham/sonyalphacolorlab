import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  applyCloudShareEnv,
  createJsonRequest,
  readJson,
  resetCloudShareEnv,
} from './test-helpers'

describe('capture session gallery endpoints', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.restoreAllMocks()
    applyCloudShareEnv()
  })

  afterEach(() => {
    vi.doUnmock('../../api/_lib/db.js')
    vi.doUnmock('../../api/_lib/r2.js')
    resetCloudShareEnv()
  })

  it('returns gallery metadata with preview and download URLs per item', async () => {
    vi.doMock('../../api/_lib/db.js', () => ({
      findCaptureSessionByToken: vi.fn(async () => ({
        session_id: 'session-1',
        download_token: 'A'.repeat(32),
        status: 'ready' as const,
        expires_at: new Date(Date.now() + 60_000).toISOString(),
        created_at: new Date().toISOString(),
        uploaded_at: new Date().toISOString(),
        deleted_at: null,
      })),
      listCaptureSessionItems: vi.fn(async () => [
        {
          capture_id: '11111111-1111-4111-8111-111111111111',
          session_id: 'session-1',
          sequence: 1,
          kind: 'photo' as const,
          storage_key: 'captures/photo/2026-04-14/item-1.jpg',
          mime_type: 'image/jpeg',
          extension: 'jpg',
          byte_size: 1_000_000,
          width: 1600,
          height: 1200,
          created_at: new Date().toISOString(),
        },
      ]),
    }))

    const { GET } = await import('../../api/capture-sessions/gallery.ts')
    const response = await GET(
      createJsonRequest(
        `https://cheesebooth.vercel.app/api/capture-sessions/gallery?token=${'A'.repeat(32)}`,
        {
          method: 'GET',
        },
      ),
    )

    const payload = await readJson<{
      sessionId: string
      items: Array<{
        previewUrl: string
        downloadUrl: string
      }>
    }>(response)

    expect(response.status).toBe(200)
    expect(payload.sessionId).toBe('session-1')
    expect(payload.items[0]?.previewUrl).toContain(
      '/api/capture-sessions/media?token=',
    )
    expect(payload.items[0]?.downloadUrl).toContain('disposition=attachment')
  })

  it('redirects media requests to a signed R2 URL with the requested disposition', async () => {
    const createSignedDownloadUrl = vi.fn(
      async () => 'https://download.example/capture-session-item',
    )

    vi.doMock('../../api/_lib/db.js', () => ({
      findCaptureSessionByToken: vi.fn(async () => ({
        session_id: 'session-1',
        download_token: 'B'.repeat(32),
        status: 'ready' as const,
        expires_at: new Date(Date.now() + 60_000).toISOString(),
        created_at: new Date().toISOString(),
        uploaded_at: new Date().toISOString(),
        deleted_at: null,
      })),
      listCaptureSessionItems: vi.fn(async () => [
        {
          capture_id: '11111111-1111-4111-8111-111111111111',
          session_id: 'session-1',
          sequence: 1,
          kind: 'photo' as const,
          storage_key: 'captures/photo/2026-04-14/item-1.jpg',
          mime_type: 'image/jpeg',
          extension: 'jpg',
          byte_size: 1_000_000,
          width: 1600,
          height: 1200,
          created_at: new Date().toISOString(),
        },
      ]),
    }))
    vi.doMock('../../api/_lib/r2.js', () => ({
      createSignedDownloadUrl,
    }))

    const { GET } = await import('../../api/capture-sessions/media.ts')
    const response = await GET(
      createJsonRequest(
        `https://cheesebooth.vercel.app/api/capture-sessions/media?token=${'B'.repeat(32)}&captureId=11111111-1111-4111-8111-111111111111&disposition=inline`,
        {
          method: 'GET',
        },
      ),
    )

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe(
      'https://download.example/capture-session-item',
    )
    expect(createSignedDownloadUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        disposition: 'inline',
      }),
    )
  })

  it('returns performance items in gallery payloads and media downloads', async () => {
    const createSignedDownloadUrl = vi.fn(
      async () => 'https://download.example/performance-item',
    )

    vi.doMock('../../api/_lib/db.js', () => ({
      findCaptureSessionByToken: vi.fn(async () => ({
        session_id: 'session-performance',
        download_token: 'C'.repeat(32),
        status: 'ready' as const,
        expires_at: new Date(Date.now() + 60_000).toISOString(),
        created_at: new Date().toISOString(),
        uploaded_at: new Date().toISOString(),
        deleted_at: null,
      })),
      listCaptureSessionItems: vi.fn(async () => [
        {
          capture_id: '22222222-2222-4222-8222-222222222222',
          session_id: 'session-performance',
          sequence: 1,
          kind: 'performance' as const,
          storage_key: 'captures/performance/2026-04-16/item-1.mp4',
          mime_type: 'video/mp4',
          extension: 'mp4',
          byte_size: 80_000_000,
          width: 2048,
          height: 1152,
          created_at: new Date().toISOString(),
        },
      ]),
    }))
    vi.doMock('../../api/_lib/r2.js', () => ({
      createSignedDownloadUrl,
    }))

    const { GET: galleryGet } = await import('../../api/capture-sessions/gallery.ts')
    const galleryResponse = await galleryGet(
      createJsonRequest(
        `https://cheesebooth.vercel.app/api/capture-sessions/gallery?token=${'C'.repeat(32)}`,
        {
          method: 'GET',
        },
      ),
    )
    const galleryPayload = await readJson<{
      items: Array<{ kind: string; extension: string }>
    }>(galleryResponse)

    expect(galleryResponse.status).toBe(200)
    expect(galleryPayload.items[0]?.kind).toBe('performance')
    expect(galleryPayload.items[0]?.extension).toBe('mp4')

    const { GET: mediaGet } = await import('../../api/capture-sessions/media.ts')
    const mediaResponse = await mediaGet(
      createJsonRequest(
        `https://cheesebooth.vercel.app/api/capture-sessions/media?token=${'C'.repeat(32)}&captureId=22222222-2222-4222-8222-222222222222&disposition=attachment`,
        {
          method: 'GET',
        },
      ),
    )

    expect(mediaResponse.status).toBe(302)
    expect(createSignedDownloadUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        downloadFileName: expect.stringContaining('performance-01-'),
      }),
    )
  })
})

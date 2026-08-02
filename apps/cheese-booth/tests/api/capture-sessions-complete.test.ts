import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  applyCloudShareEnv,
  createJsonRequest,
  readJson,
  resetCloudShareEnv,
} from './test-helpers'

describe('api/capture-sessions/complete', () => {
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

  it('creates one gallery token after every session item is uploaded', async () => {
    const findCaptureSessionById = vi.fn(async () => ({
      session_id: 'session-1',
      download_token: null,
      status: 'pending_upload' as const,
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      created_at: new Date().toISOString(),
      uploaded_at: null,
      deleted_at: null,
    }))
    const listCaptureSessionItems = vi.fn(async () => [
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
      {
        capture_id: '22222222-2222-4222-8222-222222222222',
        session_id: 'session-1',
        sequence: 2,
        kind: 'boomerang' as const,
        storage_key: 'captures/boomerang/2026-04-14/item-2.mp4',
        mime_type: 'video/mp4',
        extension: 'mp4',
        byte_size: 6_000_000,
        width: 1440,
        height: 1080,
        created_at: new Date().toISOString(),
      },
    ])
    const markCaptureSessionReady = vi.fn(async (_sessionId: string, downloadToken: string) => ({
      session_id: 'session-1',
      download_token: downloadToken,
      status: 'ready' as const,
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      created_at: new Date().toISOString(),
      uploaded_at: new Date().toISOString(),
      deleted_at: null,
    }))
    const verifyObjectExists = vi.fn(async () => true)

    vi.doMock('../../api/_lib/db.js', () => ({
      findCaptureSessionById,
      listCaptureSessionItems,
      markCaptureSessionReady,
    }))
    vi.doMock('../../api/_lib/r2.js', () => ({
      verifyObjectExists,
    }))

    const { POST } = await import('../../api/capture-sessions/complete.ts')
    const response = await POST(
      createJsonRequest('https://cheesebooth.vercel.app/api/capture-sessions/complete', {
        origin: 'https://cheesebooth.vercel.app',
        body: {
          sessionId: 'session-1',
        },
      }),
    )

    const payload = await readJson<{
      downloadToken: string
      galleryUrl: string
      expiresAt: string
    }>(response)

    expect(response.status).toBe(200)
    expect(payload.downloadToken).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(payload.galleryUrl).toBe(
      `https://cheesebooth.vercel.app/#/session/${payload.downloadToken}`,
    )
    expect(verifyObjectExists).toHaveBeenCalledTimes(2)
    expect(markCaptureSessionReady).toHaveBeenCalledOnce()
  })

  it('rejects completion while some session items are still missing in object storage', async () => {
    vi.doMock('../../api/_lib/db.js', () => ({
      findCaptureSessionById: vi.fn(async () => ({
        session_id: 'session-1',
        download_token: null,
        status: 'pending_upload' as const,
        expires_at: new Date(Date.now() + 60_000).toISOString(),
        created_at: new Date().toISOString(),
        uploaded_at: null,
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
      markCaptureSessionReady: vi.fn(),
    }))
    vi.doMock('../../api/_lib/r2.js', () => ({
      verifyObjectExists: vi.fn(async () => false),
    }))

    const { POST } = await import('../../api/capture-sessions/complete.ts')
    const response = await POST(
      createJsonRequest('https://cheesebooth.vercel.app/api/capture-sessions/complete', {
        origin: 'https://cheesebooth.vercel.app',
        body: {
          sessionId: 'session-1',
        },
      }),
    )

    const payload = await readJson<{ code: string }>(response)

    expect(response.status).toBe(409)
    expect(payload.code).toBe('capture_session_upload_incomplete')
  })
})


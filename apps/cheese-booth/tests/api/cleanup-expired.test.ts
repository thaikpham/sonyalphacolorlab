import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  applyCloudShareEnv,
  createJsonRequest,
  readJson,
  resetCloudShareEnv,
} from './test-helpers'

describe('api/cron/cleanup-expired', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.doUnmock('../../api/_lib/db.js')
    vi.doUnmock('../../api/_lib/r2.js')
    resetCloudShareEnv()
  })

  it('fails closed when CRON_SECRET is missing', async () => {
    applyCloudShareEnv({
      CRON_SECRET: '',
    })

    vi.doMock('../../api/_lib/db.js', () => ({
      listExpiredCaptures: vi.fn(async () => []),
      markCaptureDeleted: vi.fn(async () => undefined),
    }))
    vi.doMock('../../api/_lib/r2.js', () => ({
      deleteObjectIfExists: vi.fn(async () => undefined),
    }))

    const { GET } = await import('../../api/cron/cleanup-expired.ts')
    const response = await GET(
      createJsonRequest('https://cheesebooth.vercel.app/api/cron/cleanup-expired', {
        method: 'GET',
      }),
    )

    const payload = await readJson<{ code: string }>(response)

    expect(response.status).toBe(503)
    expect(payload.code).toBe('cron_secret_missing')
  })

  it('rejects an invalid cleanup secret', async () => {
    applyCloudShareEnv()

    vi.doMock('../../api/_lib/db.js', () => ({
      listExpiredCaptures: vi.fn(async () => []),
      markCaptureDeleted: vi.fn(async () => undefined),
    }))
    vi.doMock('../../api/_lib/r2.js', () => ({
      deleteObjectIfExists: vi.fn(async () => undefined),
    }))

    const { GET } = await import('../../api/cron/cleanup-expired.ts')
    const response = await GET(
      createJsonRequest('https://cheesebooth.vercel.app/api/cron/cleanup-expired', {
        method: 'GET',
        headers: {
          authorization: 'Bearer wrong-secret',
        },
      }),
    )

    const payload = await readJson<{ code: string }>(response)

    expect(response.status).toBe(401)
    expect(payload.code).toBe('invalid_cron_secret')
  })

  it('cleans up expired capture sessions and every item inside them', async () => {
    applyCloudShareEnv()

    const listExpiredCaptures = vi.fn(async () => [])
    const listExpiredCaptureSessions = vi
      .fn()
      .mockResolvedValueOnce([
        {
          session_id: 'session-1',
          download_token: 'A'.repeat(32),
          status: 'ready' as const,
          expires_at: new Date(Date.now() - 60_000).toISOString(),
          created_at: new Date().toISOString(),
          uploaded_at: new Date().toISOString(),
          deleted_at: null,
        },
      ])
      .mockResolvedValue([])
    const listCaptureSessionItems = vi.fn(async () => [
      {
        capture_id: 'capture-1',
        session_id: 'session-1',
        sequence: 1,
        kind: 'photo' as const,
        storage_key: 'captures/photo/2026-04-14/item-1.jpg',
        mime_type: 'image/jpeg',
        extension: 'jpg',
        byte_size: 1_200_000,
        width: 1600,
        height: 1200,
        created_at: new Date().toISOString(),
      },
      {
        capture_id: 'capture-2',
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
    const markCaptureSessionDeleted = vi.fn(async () => undefined)
    const deleteObjectIfExists = vi.fn(async () => undefined)

    vi.doMock('../../api/_lib/db.js', () => ({
      listExpiredCaptures,
      markCaptureDeleted: vi.fn(async () => undefined),
      listExpiredCaptureSessions,
      listCaptureSessionItems,
      markCaptureSessionDeleted,
    }))
    vi.doMock('../../api/_lib/r2.js', () => ({
      deleteObjectIfExists,
    }))

    const { GET } = await import('../../api/cron/cleanup-expired.ts')
    const response = await GET(
      createJsonRequest('https://cheesebooth.vercel.app/api/cron/cleanup-expired', {
        method: 'GET',
        headers: {
          authorization: 'Bearer test-cron-secret',
        },
      }),
    )

    const payload = await readJson<{
      processed: number
      deleted: number
      failed: number
    }>(response)

    expect(response.status).toBe(200)
    expect(payload.processed).toBe(1)
    expect(payload.deleted).toBe(1)
    expect(payload.failed).toBe(0)
    expect(deleteObjectIfExists).toHaveBeenCalledTimes(2)
    expect(markCaptureSessionDeleted).toHaveBeenCalledWith('session-1')
  })
})

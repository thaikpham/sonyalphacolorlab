import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  applyCloudShareEnv,
  createJsonRequest,
  readJson,
  resetCloudShareEnv,
} from './test-helpers'

describe('api/captures/complete', () => {
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

  it('requires the uploaded object to exist before completion succeeds', async () => {
    const findCaptureById = vi.fn(async () => ({
      capture_id: 'capture-1',
      kind: 'photo' as const,
      storage_key: 'captures/photo/2026-04-13/capture-1.jpg',
      mime_type: 'image/jpeg',
      extension: 'jpg',
      byte_size: 1_200_000,
      width: 1600,
      height: 1200,
      download_token: null,
      status: 'pending_upload' as const,
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      created_at: new Date().toISOString(),
      uploaded_at: null,
      deleted_at: null,
    }))
    const markCaptureReady = vi.fn(async () => null)
    const verifyObjectExists = vi.fn(async () => false)

    vi.doMock('../../api/_lib/db.js', () => ({
      findCaptureById,
      markCaptureReady,
    }))
    vi.doMock('../../api/_lib/r2.js', () => ({
      verifyObjectExists,
    }))

    const { POST } = await import('../../api/captures/complete.ts')
    const response = await POST(
      createJsonRequest('https://cheesebooth.vercel.app/api/captures/complete', {
        origin: 'https://cheesebooth.vercel.app',
        body: {
          captureId: 'capture-1',
        },
      }),
    )

    const payload = await readJson<{ code: string }>(response)

    expect(response.status).toBe(409)
    expect(payload.code).toBe('capture_upload_incomplete')
    expect(verifyObjectExists).toHaveBeenCalledOnce()
    expect(markCaptureReady).not.toHaveBeenCalled()
  })
})

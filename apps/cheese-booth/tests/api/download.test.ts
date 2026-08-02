import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createJsonRequest, readJson } from './test-helpers'

describe('api/download', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.doUnmock('../../api/_lib/db.js')
    vi.doUnmock('../../api/_lib/r2.js')
  })

  it('redirects to a short-lived signed URL when the token is valid', async () => {
    const findCaptureByToken = vi.fn(async () => ({
      capture_id: 'capture-1',
      kind: 'photo' as const,
      storage_key: 'captures/photo/2026-04-13/capture-1.jpg',
      mime_type: 'image/jpeg',
      extension: 'jpg',
      byte_size: 1_200_000,
      width: 1600,
      height: 1200,
      download_token: 'A'.repeat(32),
      status: 'ready' as const,
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      created_at: new Date().toISOString(),
      uploaded_at: new Date().toISOString(),
      deleted_at: null,
    }))
    const createSignedDownloadUrl = vi.fn(
      async () => 'https://download.example/captures/photo/capture-1.jpg',
    )

    vi.doMock('../../api/_lib/db.js', () => ({
      findCaptureByToken,
    }))
    vi.doMock('../../api/_lib/r2.js', () => ({
      createSignedDownloadUrl,
    }))

    const { GET } = await import('../../api/download.ts')
    const response = await GET(
      createJsonRequest(
        `https://cheesebooth.vercel.app/api/download?token=${'A'.repeat(32)}`,
        {
          method: 'GET',
        },
      ),
    )

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe(
      'https://download.example/captures/photo/capture-1.jpg',
    )
    expect(response.headers.get('x-request-id')).toBeTruthy()
  })

  it('returns 410 when the token has expired', async () => {
    const findCaptureByToken = vi.fn(async () => ({
      capture_id: 'capture-1',
      kind: 'photo' as const,
      storage_key: 'captures/photo/2026-04-13/capture-1.jpg',
      mime_type: 'image/jpeg',
      extension: 'jpg',
      byte_size: 1_200_000,
      width: 1600,
      height: 1200,
      download_token: 'B'.repeat(32),
      status: 'ready' as const,
      expires_at: new Date(Date.now() - 60_000).toISOString(),
      created_at: new Date().toISOString(),
      uploaded_at: new Date().toISOString(),
      deleted_at: null,
    }))

    vi.doMock('../../api/_lib/db.js', () => ({
      findCaptureByToken,
    }))
    vi.doMock('../../api/_lib/r2.js', () => ({
      createSignedDownloadUrl: vi.fn(),
    }))

    const { GET } = await import('../../api/download.ts')
    const response = await GET(
      createJsonRequest(
        `https://cheesebooth.vercel.app/api/download?token=${'B'.repeat(32)}`,
        {
          method: 'GET',
        },
      ),
    )

    const payload = await readJson<{ code: string }>(response)

    expect(response.status).toBe(410)
    expect(payload.code).toBe('download_token_expired')
  })
})

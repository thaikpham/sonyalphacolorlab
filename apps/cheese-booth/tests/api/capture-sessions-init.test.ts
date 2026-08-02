import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  applyCloudShareEnv,
  createJsonRequest,
  readJson,
  resetCloudShareEnv,
} from './test-helpers'

describe('api/capture-sessions/init', () => {
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

  it('accepts up to four mixed media items and returns upload targets', async () => {
    const createPendingCaptureSession = vi.fn(async () => undefined)
    const createSignedUploadUrl = vi.fn(async (storageKey: string, mimeType: string) => ({
      url: `https://upload.example/${storageKey}`,
      method: 'PUT' as const,
      headers: {
        'Content-Type': mimeType,
      },
    }))

    vi.doMock('../../api/_lib/db.js', () => ({
      createPendingCaptureSession,
    }))
    vi.doMock('../../api/_lib/r2.js', () => ({
      createSignedUploadUrl,
    }))

    const { POST } = await import('../../api/capture-sessions/init.ts')
    const response = await POST(
      createJsonRequest('https://cheesebooth.vercel.app/api/capture-sessions/init', {
        origin: 'https://cheesebooth.vercel.app',
        body: {
          items: [
            {
              sequence: 1,
              kind: 'photo',
              mimeType: 'image/png',
              extension: 'png',
              byteSize: 14_400_000,
              width: 4096,
              height: 3072,
            },
            {
              sequence: 2,
              kind: 'boomerang',
              mimeType: 'video/mp4',
              extension: 'mp4',
              byteSize: 8_100_000,
              width: 1440,
              height: 1080,
            },
          ],
        },
      }),
    )

    const payload = await readJson<{
      sessionId: string
      expiresAt: string
      items: Array<{
        captureId: string
        sequence: number
        upload: { url: string; method: string }
      }>
    }>(response)

    expect(response.status).toBe(200)
    expect(payload.sessionId).toBeTypeOf('string')
    expect(payload.items).toHaveLength(2)
    expect(payload.items[0]?.sequence).toBe(1)
    expect(payload.items[1]?.sequence).toBe(2)
    expect(payload.items[0]?.upload.method).toBe('PUT')
    expect(createPendingCaptureSession).toHaveBeenCalledOnce()
    expect(createSignedUploadUrl).toHaveBeenCalledTimes(2)
  })

  it('rejects sessions larger than four items', async () => {
    vi.doMock('../../api/_lib/db.js', () => ({
      createPendingCaptureSession: vi.fn(),
    }))
    vi.doMock('../../api/_lib/r2.js', () => ({
      createSignedUploadUrl: vi.fn(),
    }))

    const { POST } = await import('../../api/capture-sessions/init.ts')
    const response = await POST(
      createJsonRequest('https://cheesebooth.vercel.app/api/capture-sessions/init', {
        origin: 'https://cheesebooth.vercel.app',
        body: {
          items: Array.from({ length: 5 }, (_, index) => ({
            sequence: index + 1,
            kind: 'photo',
            mimeType: 'image/jpeg',
            extension: 'jpg',
            byteSize: 1_200_000,
            width: 1600,
            height: 1200,
          })),
        },
      }),
    )

    const payload = await readJson<{ code: string }>(response)

    expect(response.status).toBe(400)
    expect(payload.code).toBe('capture_session_item_limit_exceeded')
  })

  it('accepts a single performance clip and rejects mixed performance sessions', async () => {
    const createPendingCaptureSession = vi.fn(async () => undefined)
    const createSignedUploadUrl = vi.fn(async (storageKey: string, mimeType: string) => ({
      url: `https://upload.example/${storageKey}`,
      method: 'PUT' as const,
      headers: {
        'Content-Type': mimeType,
      },
    }))

    vi.doMock('../../api/_lib/db.js', () => ({
      createPendingCaptureSession,
    }))
    vi.doMock('../../api/_lib/r2.js', () => ({
      createSignedUploadUrl,
    }))

    const { POST } = await import('../../api/capture-sessions/init.ts')

    const acceptedResponse = await POST(
      createJsonRequest('https://cheesebooth.vercel.app/api/capture-sessions/init', {
        origin: 'https://cheesebooth.vercel.app',
        body: {
          items: [
            {
              sequence: 1,
              kind: 'performance',
              mimeType: 'video/mp4',
              extension: 'mp4',
              byteSize: 80_000_000,
              width: 2048,
              height: 1152,
            },
          ],
        },
      }),
    )

    expect(acceptedResponse.status).toBe(200)

    const rejectedResponse = await POST(
      createJsonRequest('https://cheesebooth.vercel.app/api/capture-sessions/init', {
        origin: 'https://cheesebooth.vercel.app',
        body: {
          items: [
            {
              sequence: 1,
              kind: 'performance',
              mimeType: 'video/mp4',
              extension: 'mp4',
              byteSize: 80_000_000,
              width: 2048,
              height: 1152,
            },
            {
              sequence: 2,
              kind: 'photo',
              mimeType: 'image/png',
              extension: 'png',
              byteSize: 1_200_000,
              width: 1600,
              height: 1200,
            },
          ],
        },
      }),
    )
    const rejectedPayload = await readJson<{ code: string }>(rejectedResponse)

    expect(rejectedResponse.status).toBe(400)
    expect(rejectedPayload.code).toBe('capture_session_performance_limit_exceeded')
  })
})

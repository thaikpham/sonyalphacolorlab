import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  applyCloudShareEnv,
  createJsonRequest,
  readJson,
  resetCloudShareEnv,
} from './test-helpers'

describe('api/captures/init', () => {
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

  it('accepts a valid booth photo payload as PNG', async () => {
    const createPendingCapture = vi.fn(async () => undefined)
    const createSignedUploadUrl = vi.fn(async (storageKey: string, mimeType: string) => ({
      url: `https://upload.example/${storageKey}`,
      method: 'PUT' as const,
      headers: {
        'Content-Type': mimeType,
      },
    }))

    vi.doMock('../../api/_lib/db.js', () => ({
      createPendingCapture,
    }))
    vi.doMock('../../api/_lib/r2.js', () => ({
      createSignedUploadUrl,
    }))

    const { POST } = await import('../../api/captures/init.ts')
    const response = await POST(
      createJsonRequest('https://cheesebooth.vercel.app/api/captures/init', {
        origin: 'https://cheesebooth.vercel.app',
        body: {
          kind: 'photo',
          mimeType: 'image/png',
          extension: 'png',
          byteSize: 14_400_000,
          width: 4096,
          height: 3072,
        },
      }),
    )

    const payload = await readJson<{
      captureId: string
      storageKey: string
      upload: { url: string }
    }>(response)

    expect(response.status).toBe(200)
    expect(response.headers.get('x-request-id')).toBeTruthy()
    expect(payload.captureId).toBeTypeOf('string')
    expect(payload.storageKey).toMatch(/^captures\/photo\//)
    expect(payload.upload.url).toContain('https://upload.example/')
    expect(createPendingCapture).toHaveBeenCalledOnce()
    expect(createSignedUploadUrl).toHaveBeenCalledOnce()
  })

  it('rejects payloads outside the booth capture policy', async () => {
    const createPendingCapture = vi.fn(async () => undefined)
    const createSignedUploadUrl = vi.fn()

    vi.doMock('../../api/_lib/db.js', () => ({
      createPendingCapture,
    }))
    vi.doMock('../../api/_lib/r2.js', () => ({
      createSignedUploadUrl,
    }))

    const { POST } = await import('../../api/captures/init.ts')
    const response = await POST(
      createJsonRequest('https://cheesebooth.vercel.app/api/captures/init', {
        origin: 'https://cheesebooth.vercel.app',
        body: {
          kind: 'photo',
          mimeType: 'image/webp',
          extension: 'webp',
          byteSize: 512_000,
          width: 1600,
          height: 1200,
        },
      }),
    )

    const payload = await readJson<{
      error: string
      code: string
      requestId: string
    }>(response)

    expect(response.status).toBe(400)
    expect(payload.code).toBe('invalid_capture_mime_type')
    expect(payload.requestId).toBeTypeOf('string')
    expect(createPendingCapture).not.toHaveBeenCalled()
    expect(createSignedUploadUrl).not.toHaveBeenCalled()
  })

  it('rejects requests from a mismatched origin', async () => {
    const createPendingCapture = vi.fn(async () => undefined)

    vi.doMock('../../api/_lib/db.js', () => ({
      createPendingCapture,
    }))
    vi.doMock('../../api/_lib/r2.js', () => ({
      createSignedUploadUrl: vi.fn(),
    }))

    const { POST } = await import('../../api/captures/init.ts')
    const response = await POST(
      createJsonRequest('https://cheesebooth.vercel.app/api/captures/init', {
        origin: 'https://evil.example',
        body: {
          kind: 'photo',
          mimeType: 'image/jpeg',
          extension: 'jpg',
          byteSize: 512_000,
          width: 1600,
          height: 1200,
        },
      }),
    )

    const payload = await readJson<{ code: string }>(response)

    expect(response.status).toBe(403)
    expect(payload.code).toBe('origin_not_allowed')
    expect(createPendingCapture).not.toHaveBeenCalled()
  })
})

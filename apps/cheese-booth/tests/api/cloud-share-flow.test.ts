import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  applyCloudShareEnv,
  createJsonRequest,
  readJson,
  resetCloudShareEnv,
} from './test-helpers'

interface MockCaptureRecord {
  capture_id: string
  kind: 'photo' | 'boomerang' | 'performance'
  storage_key: string
  mime_type: string
  extension: string
  byte_size: number
  width: number
  height: number
  download_token: string | null
  status: 'pending_upload' | 'ready' | 'deleted'
  expires_at: string
  created_at: string
  uploaded_at: string | null
  deleted_at: string | null
}

describe('cloud share API smoke flow', () => {
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

  it('covers init -> upload -> complete -> download without changing the public API shape', async () => {
    const captures = new Map<string, MockCaptureRecord>()
    const uploadedStorageKeys = new Set<string>()

    vi.doMock('../../api/_lib/db.js', () => ({
      createPendingCapture: vi.fn(async (input: {
        captureId: string
        kind: 'photo' | 'boomerang' | 'performance'
        storageKey: string
        mimeType: string
        extension: string
        byteSize: number
        width: number
        height: number
        expiresAt: Date
      }) => {
        captures.set(input.captureId, {
          capture_id: input.captureId,
          kind: input.kind,
          storage_key: input.storageKey,
          mime_type: input.mimeType,
          extension: input.extension,
          byte_size: input.byteSize,
          width: input.width,
          height: input.height,
          download_token: null,
          status: 'pending_upload',
          expires_at: input.expiresAt.toISOString(),
          created_at: new Date().toISOString(),
          uploaded_at: null,
          deleted_at: null,
        })
      }),
      findCaptureById: vi.fn(async (captureId: string) => captures.get(captureId) ?? null),
      findCaptureByToken: vi.fn(
        async (token: string) =>
          [...captures.values()].find((capture) => capture.download_token === token) ?? null,
      ),
      markCaptureReady: vi.fn(async (captureId: string, downloadToken: string) => {
        const capture = captures.get(captureId)

        if (!capture || capture.status !== 'pending_upload') {
          return null
        }

        const nextCapture: MockCaptureRecord = {
          ...capture,
          download_token: downloadToken,
          status: 'ready',
          uploaded_at: new Date().toISOString(),
        }

        captures.set(captureId, nextCapture)

        return nextCapture
      }),
    }))

    vi.doMock('../../api/_lib/r2.js', () => ({
      createSignedUploadUrl: vi.fn(async (storageKey: string, mimeType: string) => ({
        url: `https://upload.example/${storageKey}`,
        method: 'PUT' as const,
        headers: {
          'Content-Type': mimeType,
        },
      })),
      verifyObjectExists: vi.fn(async (storageKey: string) => uploadedStorageKeys.has(storageKey)),
      createSignedDownloadUrl: vi.fn(
        async ({ storageKey }: { storageKey: string }) =>
          `https://download.example/${storageKey}`,
      ),
    }))

    const { POST: initCapture } = await import('../../api/captures/init.ts')
    const { POST: completeCapture } = await import('../../api/captures/complete.ts')
    const { GET: downloadCapture } = await import('../../api/download.ts')

    const initResponse = await initCapture(
      createJsonRequest('https://cheesebooth.vercel.app/api/captures/init', {
        origin: 'https://cheesebooth.vercel.app',
        body: {
          kind: 'photo',
          mimeType: 'image/jpeg',
          extension: 'jpg',
          byteSize: 1_500_000,
          width: 1600,
          height: 1200,
        },
      }),
    )
    const initPayload = await readJson<{
      captureId: string
      storageKey: string
      upload: { url: string; method: string; headers: Record<string, string> }
    }>(initResponse)

    expect(initResponse.status).toBe(200)
    expect(initPayload.upload.method).toBe('PUT')

    uploadedStorageKeys.add(initPayload.storageKey)

    const completeResponse = await completeCapture(
      createJsonRequest('https://cheesebooth.vercel.app/api/captures/complete', {
        origin: 'https://cheesebooth.vercel.app',
        body: {
          captureId: initPayload.captureId,
        },
      }),
    )
    const completePayload = await readJson<{
      downloadToken: string
      downloadUrl: string
      expiresAt: string
    }>(completeResponse)

    expect(completeResponse.status).toBe(200)
    expect(completePayload.downloadToken).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(completePayload.downloadUrl).toBe(
      `https://cheesebooth.vercel.app/${completePayload.downloadToken}`,
    )

    const downloadResponse = await downloadCapture(
      createJsonRequest(
        `https://cheesebooth.vercel.app/api/download?token=${completePayload.downloadToken}`,
        {
          method: 'GET',
        },
      ),
    )

    expect(downloadResponse.status).toBe(302)
    expect(downloadResponse.headers.get('location')).toBe(
      `https://download.example/${initPayload.storageKey}`,
    )
  })
})

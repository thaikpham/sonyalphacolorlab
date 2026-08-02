import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  applyCloudShareEnv,
  createJsonRequest,
  readJson,
  resetCloudShareEnv,
} from './test-helpers'

describe('api/health/cloud-share', () => {
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

  it('returns ready when env, database, and signer are healthy', async () => {
    const pingDatabase = vi.fn(async () => undefined)
    const createSignedUploadUrl = vi.fn(async () => ({
      url: 'https://upload.example/healthcheck',
      method: 'PUT' as const,
      headers: {
        'Content-Type': 'application/octet-stream',
      },
    }))

    vi.doMock('../../api/_lib/db.js', () => ({
      pingDatabase,
    }))
    vi.doMock('../../api/_lib/r2.js', () => ({
      createSignedUploadUrl,
    }))

    const { GET } = await import('../../api/health/cloud-share.ts')
    const response = await GET(
      createJsonRequest('https://cheesebooth.vercel.app/api/health/cloud-share', {
        method: 'GET',
      }),
    )

    const payload = await readJson<{
      ok: boolean
      checks: Record<string, string>
      requestId: string
    }>(response)

    expect(response.status).toBe(200)
    expect(payload.ok).toBe(true)
    expect(payload.checks).toEqual({
      env: 'ready',
      database: 'ready',
      r2Signer: 'ready',
    })
    expect(payload.requestId).toBeTypeOf('string')
    expect(pingDatabase).toHaveBeenCalledOnce()
    expect(createSignedUploadUrl).toHaveBeenCalledOnce()
  })
})

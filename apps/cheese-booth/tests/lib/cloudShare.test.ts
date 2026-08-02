import { afterEach, describe, expect, it, vi } from 'vitest'

describe('cloudShare client error parsing', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    delete (globalThis as typeof globalThis & { window?: unknown }).window
  })

  it('surfaces plain-text backend errors without reading the body twice', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response('Backend exploded', {
          status: 500,
          headers: {
            'content-type': 'text/plain',
          },
        }),
      ),
    )

    const { initCloudCaptureSession } = await import('../../src/lib/cloudShare')

    await expect(
      initCloudCaptureSession([
        {
          sequence: 1,
          kind: 'photo',
          mimeType: 'image/jpeg',
          extension: 'jpg',
          byteSize: 1200,
          width: 1600,
          height: 1200,
        },
      ]),
    ).rejects.toThrow('Backend exploded')
  })

  it('shows a localhost guidance message when using Vite-only runtime', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response('Cannot POST /api/capture-sessions/init', {
          status: 404,
          headers: {
            'content-type': 'text/plain',
          },
        }),
      ),
    )

    ;(globalThis as typeof globalThis & {
      window?: {
        location: {
          hostname: string
          port: string
          origin: string
        }
      }
    }).window = {
      location: {
        hostname: 'localhost',
        port: '5173',
        origin: 'http://localhost:5173',
      },
    }

    const { initCloudCaptureSession } = await import('../../src/lib/cloudShare')

    await expect(
      initCloudCaptureSession([
        {
          sequence: 1,
          kind: 'photo',
          mimeType: 'image/jpeg',
          extension: 'jpg',
          byteSize: 1200,
          width: 1600,
          height: 1200,
        },
      ]),
    ).rejects.toThrow(/vercel dev|VITE_CLOUD_SHARE_API_BASE/i)
  })

  it('keeps session and legacy cloud-share clients on separate API paths', async () => {
    const fetchSpy = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.includes('/api/capture-sessions/init')) {
        return new Response(
          JSON.stringify({
            sessionId: 'session-1',
            expiresAt: '2026-04-16T00:00:00.000Z',
            items: [
              {
                captureId: 'capture-1',
                sequence: 1,
                upload: {
                  url: 'https://upload.example/session-1',
                  method: 'PUT',
                  headers: {
                    'Content-Type': 'image/jpeg',
                  },
                },
              },
            ],
          }),
          {
            status: 200,
            headers: {
              'content-type': 'application/json',
            },
          },
        )
      }

      return new Response(
        JSON.stringify({
          captureId: 'capture-legacy',
          storageKey: 'legacy/key.jpg',
          upload: {
            url: 'https://upload.example/legacy',
            method: 'PUT',
            headers: {
              'Content-Type': 'image/jpeg',
            },
          },
          expiresAt: '2026-04-16T00:00:00.000Z',
        }),
        {
          status: 200,
          headers: {
            'content-type': 'application/json',
          },
        },
      )
    })

    vi.stubGlobal('fetch', fetchSpy)

    const { initCloudCaptureSession, initCloudCaptureShare } = await import(
      '../../src/lib/cloudShare'
    )

    await initCloudCaptureShare({
      kind: 'photo',
      mimeType: 'image/jpeg',
      extension: 'jpg',
      byteSize: 1200,
      width: 1600,
      height: 1200,
    })
    await initCloudCaptureSession([
      {
        sequence: 1,
        kind: 'photo',
        mimeType: 'image/jpeg',
        extension: 'jpg',
        byteSize: 1200,
        width: 1600,
        height: 1200,
      },
    ])

    expect(String(fetchSpy.mock.calls[0]?.[0])).toContain('/api/captures/init')
    expect(String(fetchSpy.mock.calls[1]?.[0])).toContain(
      '/api/capture-sessions/init',
    )
  })
})

import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  buildGeminiRequestBody,
  callGemini,
  readStoredModel,
  stripJsonFence,
} from '../src/lib/gemini'

/**
 * The point of these tests is the one thing that must never regress: the API
 * key travels in a header, never in the URL. A key in a query string is
 * recorded by every proxy log, browser history entry and Referer header, and
 * the previous version of this code put it there.
 */

const store = new Map<string, string>()

vi.stubGlobal('localStorage', {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => void store.set(key, value),
  removeItem: (key: string) => void store.delete(key),
  clear: () => store.clear(),
})

afterEach(() => {
  store.clear()
})

describe('callGemini', () => {
  function mockFetchOnce(body: unknown, ok = true, status = 200) {
    const fetchMock = vi.fn().mockResolvedValue({
      ok,
      status,
      statusText: ok ? 'OK' : 'Bad Request',
      json: async () => body,
    })
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
  }

  it('sends the key as a header and never in the URL', async () => {
    const fetchMock = mockFetchOnce({
      candidates: [{ content: { parts: [{ text: 'xin chào' }] } }],
    })

    await callGemini({
      apiKey: 'SECRET-KEY-VALUE',
      model: 'gemini-2.5-flash',
      contents: [{ parts: [{ text: 'hi' }] }],
    })

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]

    expect(url).not.toContain('SECRET-KEY-VALUE')
    expect(url).not.toContain('key=')
    expect(url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
    )
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe(
      'SECRET-KEY-VALUE',
    )
  })

  it('returns the first candidate text and its grounding metadata', async () => {
    mockFetchOnce({
      candidates: [
        {
          content: { parts: [{ text: 'kết quả' }] },
          groundingMetadata: { webSearchQueries: ['sony fx30'] },
        },
      ],
    })

    const result = await callGemini({
      apiKey: 'k',
      model: 'm',
      contents: [{ parts: [{ text: 'q' }] }],
    })

    expect(result.text).toBe('kết quả')
    expect(result.groundingMetadata?.webSearchQueries).toEqual(['sony fx30'])
  })

  it('surfaces the API error message rather than a bare status code', async () => {
    mockFetchOnce({ error: { message: 'API key not valid' } }, false, 400)

    await expect(
      callGemini({ apiKey: 'bad', model: 'm', contents: [] }),
    ).rejects.toThrow('API key not valid')
  })

  it('falls back to the status line when the error body is not JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
      json: async () => {
        throw new Error('not json')
      },
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      callGemini({ apiKey: 'k', model: 'm', contents: [] }),
    ).rejects.toThrow('HTTP 503 Service Unavailable')
  })

  it('returns empty text when the response has no candidates', async () => {
    mockFetchOnce({})

    const result = await callGemini({ apiKey: 'k', model: 'm', contents: [] })

    expect(result.text).toBe('')
    expect(result.groundingMetadata).toBeUndefined()
  })
})

describe('buildGeminiRequestBody', () => {
  it('omits every optional block when nothing is requested', () => {
    const body = buildGeminiRequestBody({ contents: [{ parts: [{ text: 'a' }] }] })

    expect(body).toEqual({ contents: [{ parts: [{ text: 'a' }] }] })
  })

  it('adds the search tool only when useSearch is set', () => {
    expect(buildGeminiRequestBody({ contents: [], useSearch: true }).tools).toEqual([
      { google_search: {} },
    ])
    expect(buildGeminiRequestBody({ contents: [], useSearch: false }).tools).toBeUndefined()
  })

  it('wraps the system instruction in a parts array', () => {
    const body = buildGeminiRequestBody({ contents: [], systemInstruction: 'be brief' })

    expect(body.systemInstruction).toEqual({ parts: [{ text: 'be brief' }] })
  })

  it('passes the response mime type through generationConfig', () => {
    const body = buildGeminiRequestBody({
      contents: [],
      responseMimeType: 'application/json',
    })

    expect(body.generationConfig).toEqual({ responseMimeType: 'application/json' })
  })
})

describe('stripJsonFence', () => {
  it('unwraps a fenced JSON block', () => {
    expect(stripJsonFence('```json\n{"a":1}\n```')).toBe('{"a":1}')
  })

  it('handles an uppercase fence tag', () => {
    expect(stripJsonFence('```JSON\n{"a":1}\n```')).toBe('{"a":1}')
  })

  it('leaves unfenced JSON untouched', () => {
    expect(stripJsonFence('{"a":1}')).toBe('{"a":1}')
  })
})

describe('readStoredModel', () => {
  it('returns the default when nothing is stored', () => {
    expect(readStoredModel('gemini-2.5-flash')).toBe('gemini-2.5-flash')
  })

  it('upgrades a retired 1.5 id to its 2.5 equivalent', () => {
    store.set('gemini_model', 'gemini-1.5-pro')
    expect(readStoredModel('gemini-2.5-flash')).toBe('gemini-2.5-pro')

    store.set('gemini_model', 'gemini-1.5-flash')
    expect(readStoredModel('gemini-2.5-flash')).toBe('gemini-2.5-flash')
  })

  it('leaves an unknown stored id alone', () => {
    store.set('gemini_model', 'gemini-3.0-experimental')
    expect(readStoredModel('gemini-2.5-flash')).toBe('gemini-3.0-experimental')
  })

  it('does not write to localStorage', () => {
    store.set('gemini_model', 'gemini-1.5-pro')
    readStoredModel('gemini-2.5-flash')
    expect(store.get('gemini_model')).toBe('gemini-1.5-pro')
  })
})

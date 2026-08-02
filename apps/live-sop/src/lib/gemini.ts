/* ---------------------------------------------------------------------------
   Gemini client — one place, typed, key never in a URL.

   Two components used to hand-roll this fetch with `requestBody: any` and the
   key pasted into the query string. A key in a query string lands in every
   proxy log, every browser history entry and every Referer header — the same
   rule the ColorLab AGENTS.md states for emails. Google accepts the key in an
   `x-goog-api-key` header instead, which none of those record.

   The key is always the reader's own, supplied through the settings panel and
   held in localStorage. There is deliberately no build-time fallback: a
   `VITE_`-prefixed variable is inlined into the browser bundle, so shipping an
   owner-funded key that way publishes it to anyone who opens devtools.
--------------------------------------------------------------------------- */

export interface GeminiPart {
  text?: string
}

export interface GeminiContent {
  role?: 'user' | 'model'
  parts: GeminiPart[]
}

/** Web-search grounding is opaque to us — we only forward it to the renderer. */
export interface GeminiGroundingMetadata {
  webSearchQueries?: string[]
  groundingChunks?: Array<{ web?: { uri?: string; title?: string } }>
}

export interface GeminiCallOptions {
  apiKey: string
  model: string
  contents: GeminiContent[]
  systemInstruction?: string
  /** Enables the google_search tool. */
  useSearch?: boolean
  /** Set to 'application/json' to constrain the reply to JSON. */
  responseMimeType?: string
  signal?: AbortSignal
}

export interface GeminiResult {
  text: string
  groundingMetadata?: GeminiGroundingMetadata
}

interface GeminiRequestBody {
  contents: GeminiContent[]
  systemInstruction?: { parts: GeminiPart[] }
  generationConfig?: { responseMimeType?: string }
  tools?: Array<{ google_search: Record<string, never> }>
}

interface GeminiResponseBody {
  candidates?: Array<{
    content?: { parts?: GeminiPart[] }
    groundingMetadata?: GeminiGroundingMetadata
  }>
  error?: { message?: string }
}

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models'

/** Readers who used the app before the 2.5 rollout still have a 1.5 id stored. */
const RETIRED_MODELS: Record<string, string> = {
  'gemini-1.5-flash': 'gemini-2.5-flash',
  'gemini-1.5-pro': 'gemini-2.5-pro',
}

/**
 * Reads the reader's saved model, upgrading any retired id. Pure read — the
 * caller decides when to write the upgraded value back, so this is safe to use
 * from a useState initialiser.
 */
export function readStoredModel(defaultModel: string): string {
  const stored = localStorage.getItem('gemini_model')
  if (!stored) return defaultModel
  return RETIRED_MODELS[stored] ?? stored
}

export function buildGeminiRequestBody(
  options: Pick<
    GeminiCallOptions,
    'contents' | 'systemInstruction' | 'useSearch' | 'responseMimeType'
  >,
): GeminiRequestBody {
  const body: GeminiRequestBody = { contents: options.contents }

  if (options.systemInstruction) {
    body.systemInstruction = { parts: [{ text: options.systemInstruction }] }
  }

  if (options.responseMimeType) {
    body.generationConfig = { responseMimeType: options.responseMimeType }
  }

  if (options.useSearch) {
    body.tools = [{ google_search: {} }]
  }

  return body
}

/**
 * Gemini is asked for JSON but still wraps it in a ```json fence often enough
 * that every caller was stripping it by hand.
 */
export function stripJsonFence(raw: string): string {
  return raw
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim()
}

export async function callGemini(options: GeminiCallOptions): Promise<GeminiResult> {
  const response = await fetch(`${ENDPOINT}/${options.model}:generateContent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': options.apiKey,
    },
    body: JSON.stringify(buildGeminiRequestBody(options)),
    signal: options.signal,
  })

  if (!response.ok) {
    let message = `HTTP ${response.status} ${response.statusText}`

    try {
      const errorBody = (await response.json()) as GeminiResponseBody
      if (errorBody.error?.message) {
        message = errorBody.error.message
      }
    } catch {
      // Body was not JSON — the status line is all we can report.
    }

    throw new Error(message)
  }

  const data = (await response.json()) as GeminiResponseBody
  const candidate = data.candidates?.[0]

  return {
    text: candidate?.content?.parts?.[0]?.text ?? '',
    groundingMetadata: candidate?.groundingMetadata,
  }
}

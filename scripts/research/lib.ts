import type { SourceRef } from '../../src/lib/lab/types'

/** URLs from free text: whitespace-separated, `#` lines skipped, first occurrence kept. */
export function readUrls(text: string): string[] {
  const out: string[] = []
  for (const line of text.split('\n')) {
    if (line.trim().startsWith('#')) continue
    for (const word of line.split(/\s+/)) if (/^https?:\/\//.test(word) && !out.includes(word)) out.push(word)
  }
  return out
}

/** A YouTube oEmbed answer, or null when the video cannot be embedded. */
export function parseOembed(id: string, json: unknown) {
  if (!json || typeof json !== 'object') return null
  const o = json as Record<string, unknown>
  if (typeof o.title !== 'string' || typeof o.author_name !== 'string') return null
  return { id, title: o.title, channel: o.author_name, channelUrl: typeof o.author_url === 'string' ? o.author_url : '' }
}

const decode = (s: string) =>
  s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
const text = (s: string) => decode(s.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim()

/**
 * A dated source from a Sony page: the Help Guide's topic heading
 * (`id="id_title"` — its h1 is the camera's name, the same on every page),
 * else the h1, else the <title> before the first " | ".
 */
export function sourceFromHtml(url: string, html: string, today: string): SourceRef {
  const topic = /<(h[1-6])[^>]*\bid="id_title"[^>]*>([\s\S]*?)<\/\1>/i.exec(html)?.[2]
  const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html)?.[1]
  const heading = [topic, h1].map((h) => (h ? text(h) : '')).find(Boolean)
  const title = heading ?? text((/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? '').split(' | ')[0])
  return { url, title, publisher: 'Sony', checkedAt: today }
}

const SONY_DOMAINS = ['sony.net', 'sony.com', 'sony.co.uk', 'sony.com.vn', 'sony.jp', 'sony.co.jp']

/** Sony's own domains and their subdomains — the publisher a SourceRef names. */
export function isSonyHost(url: string): boolean {
  const host = new URL(url).hostname
  return SONY_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`))
}

/** `YYYY-MM-DD` in UTC — what `checkedAt` stores. */
export function todayUtc(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10)
}

/**
 * Reading a Sony Help Guide page the way `sync-camera-constants` says to:
 * the raw HTML, reduced to text — never a rendered or search-engine summary,
 * which has reported the same range two different ways in one answer.
 *
 * Only the topic is read. A current Help Guide page carries the whole guide's
 * navigation tree beside the topic, and that tree names nearly every menu
 * item on the body — so a literal looked for in the full page would be found
 * in the sidebar of an unrelated page. The topic is `<h2 id="id_title">` and
 * `<div id="id_content">`, on both the older (ILCE-7M4) and the current
 * (ILCE-7CM2, ILCE-6700, ILCE-7M5) page templates.
 */

export type HelpGuidePage = {
  /** The topic's own heading, e.g. `Creative Look (still image/movie)`. */
  readonly title: string
  /** The topic's text, normalised. */
  readonly body: string
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  hellip: '…',
  times: '×',
  minus: '−',
}

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name: string) => {
    if (name[0] === '#') {
      const code = name[1] === 'x' || name[1] === 'X' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole
    }
    return NAMED_ENTITIES[name.toLowerCase()] ?? whole
  })
}

function toText(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  )
}

/**
 * One spelling for text that Sony's markup splits across elements.
 *
 * The pages wrap menu names in their own spans, so the raw text reads
 * `[ Creative Look]`, `ST(Standard) :` and `Flash\n(only when …)`. Whitespace
 * collapses to one space; none is kept just inside a bracket or before a
 * colon, comma or full stop. Applied to the page and to every literal alike.
 */
export function normalise(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .replace(/([[(“"]) /g, '$1')
    .replace(/ ([\])”":,.;])/g, '$1')
    .trim()
}

function between(html: string, startMarker: RegExp, endMarker: RegExp): string | null {
  const start = html.search(startMarker)
  if (start < 0) return null
  const open = html.indexOf('>', start)
  const rest = html.slice(open + 1)
  const end = rest.search(endMarker)
  return end < 0 ? rest : rest.slice(0, end)
}

/** The topic of a Help Guide page, or `null` when the page is not shaped like one. */
export function helpGuideText(html: string): HelpGuidePage | null {
  const title = between(html, /<h2[^>]*\bid="id_title"/i, /<\/h2>/i)
  const body = between(html, /<div[^>]*\bid="id_content"/i, /\bid="(?:questionnaire|link_nav_prev_next)"|<\/main>/i)
  if (title === null || body === null) return null
  const page = { title: normalise(toText(title)), body: normalise(toText(body)) }
  return page.title && page.body ? page : null
}

const WORD = /[\p{L}\p{N}]/u

/**
 * Where `literal` occurs in `text` as a whole: an edge of the literal that is a
 * letter or digit must not continue into one, so `FL` is not found inside
 * `FL2` and `709:` is not found inside `ITU709:`. `null` when absent.
 */
export function findLiteral(text: string, literal: string): { index: number; context: string } | null {
  const needle = normalise(literal)
  if (!needle) return null
  const startsWord = WORD.test(needle[0])
  const endsWord = WORD.test(needle[needle.length - 1])
  for (let i = text.indexOf(needle); i >= 0; i = text.indexOf(needle, i + 1)) {
    const before = text[i - 1]
    const after = text[i + needle.length]
    if (startsWord && before !== undefined && WORD.test(before)) continue
    if (endsWord && after !== undefined && WORD.test(after)) continue
    return { index: i, context: excerpt(text, i, needle.length) }
  }
  return null
}

/** About sixty characters either side, cut at spaces — for a reviewer to read in a diff. */
function excerpt(text: string, index: number, length: number): string {
  let from = Math.max(0, index - 60)
  let to = Math.min(text.length, index + length + 60)
  if (from > 0) from = text.indexOf(' ', from) + 1 || from
  if (to < text.length) to = text.lastIndexOf(' ', to) > index + length ? text.lastIndexOf(' ', to) : to
  return `${from > 0 ? '…' : ''}${text.slice(from, to)}${to < text.length ? '…' : ''}`
}

/**
 * The part of `text` from the end of `after` to the start of `before`, both
 * found as whole literals — the extent of one list on the page, so an absence
 * can be asserted inside it and nowhere else. `null` when either end is
 * missing, which is never read as "absent".
 */
export function section(text: string, after: string, before: string): string | null {
  const a = findLiteral(text, after)
  if (!a) return null
  const from = a.index + normalise(after).length
  const b = findLiteral(text.slice(from), before)
  return b ? text.slice(from, from + b.index) : null
}

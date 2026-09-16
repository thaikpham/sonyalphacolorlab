/**
 * The runtime half of the block contract.
 *
 * `types.ts` closes `Block` as a discriminated union, and until articles were
 * authored in TypeScript that was enough: a block the file did not name could
 * not be written. It is no longer enough. An article now arrives as a `jsonb`
 * column, and `row.blocks as Block[]` is a lie the compiler is happy to
 * believe — the column can hold anything an admin's browser sent, anything an
 * older version of the editor wrote, or `null` where a `readonly [string,
 * string, string]` is promised. A `tldr` with two items would crash the rail;
 * a `table` row with four cells would render a column the header cannot name.
 *
 * So every block is parsed, never cast. The rules are the ones
 * `article-spec.test.ts` asserts over the authored catalogue, applied here to
 * the stored one — the test guards what a developer writes, this guards what
 * an editor saves, and they are the same rules.
 *
 * Two deliberate asymmetries with the test:
 *
 * - A malformed block is **dropped**, not thrown on. One bad table should cost
 *   the reader that table, not the article; and an admin who saved something
 *   this file rejects needs to see the rest of their draft to work out what.
 *   `parseBlocks` returns what survived, and the admin API reports the count
 *   so a silent drop cannot pass review unnoticed.
 * - The counts that bound an *article* (8–16 blocks, closes on a checklist)
 *   are not enforced here. They belong to a finished article, and a draft is
 *   by definition unfinished. `validateArticleShape` applies them, and only
 *   on the way to `published`.
 */

import type {
  Archetype,
  Article,
  ArticleStatus,
  Block,
  LevelId,
  TopicId,
} from './types'
import { LEVELS, TOPICS } from './articles'
import { parseAssetId } from './assets'

const TOPIC_IDS = new Set<string>(TOPICS.map((t) => t.id))
const LEVEL_IDS = new Set<string>(LEVELS.map((l) => l.id))
const ARCHETYPES = new Set<string>([
  'setup-guide',
  'versus',
  'technique',
  'explainer',
  'fix',
  'gear',
  'recipe',
])

/** Long enough for the longest authored paragraph, short enough that a paste
    of an entire web page cannot become a single block. */
const TEXT_MAX = 4000
const SHORT_MAX = 300

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/** A trimmed non-empty string within `max`, or `null`. Never a coerced number:
    `String(0)` is `'0'` and would make a missing field look present. */
function str(v: unknown, max = TEXT_MAX): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  if (!t) return null
  return t.length > max ? t.slice(0, max) : t
}

/** Like `str`, but an absent value is allowed through as `undefined`. */
function optStr(v: unknown, max = TEXT_MAX): string | undefined {
  return str(v, max) ?? undefined
}

function strArray(v: unknown, max = SHORT_MAX): string[] {
  if (!Array.isArray(v)) return []
  const out: string[] = []
  for (const item of v) {
    const s = str(item, max)
    if (s) out.push(s)
  }
  return out
}

/**
 * The eleven hosts a pasted video URL may name, and what each yields.
 *
 * Matched on the hostname after `new URL()` rather than by a substring test:
 * `'youtube.com'` appears in `https://evil.test/?x=youtube.com`, and an embed
 * built from a substring match is how a page ends up framing someone else's
 * document. The id is then constrained to the character class each provider
 * actually issues, so nothing from the URL survives into the iframe `src`
 * except those characters.
 */
const YOUTUBE_ID = /^[\w-]{11}$/
const VIMEO_ID = /^\d{6,12}$/

export type ParsedEmbed = { provider: 'youtube' | 'vimeo'; id: string }

/**
 * Reduce a pasted video URL to a provider and a bare id.
 *
 * Accepts the forms an editor actually has in their clipboard — a watch URL, a
 * `youtu.be` short link, a `/shorts/` link, an `/embed/` link, a Vimeo page —
 * and also a bare id, because "paste the id" is what someone does when the URL
 * form is refused. Everything else returns `null` and the editor is told the
 * link was not recognised, which is a better outcome than an iframe pointing
 * at a URL nobody checked.
 */
export function parseEmbedUrl(raw: string): ParsedEmbed | null {
  const value = raw.trim()
  if (!value) return null

  // A bare id, pasted on its own. Vimeo's is all digits, YouTube's is not.
  if (VIMEO_ID.test(value)) return { provider: 'vimeo', id: value }
  if (YOUTUBE_ID.test(value) && !value.includes('.')) {
    return { provider: 'youtube', id: value }
  }

  let url: URL
  try {
    url = new URL(value.includes('://') ? value : `https://${value}`)
  } catch {
    return null
  }

  const host = url.hostname.replace(/^www\./, '').toLowerCase()
  const segments = url.pathname.split('/').filter(Boolean)

  if (host === 'youtu.be') {
    const id = segments[0] ?? ''
    return YOUTUBE_ID.test(id) ? { provider: 'youtube', id } : null
  }

  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
    /* `/watch?v=`, plus the three path forms. `shorts` and `live` are the two
       that a mobile share sheet produces and a `v=` lookup alone would miss. */
    const fromQuery = url.searchParams.get('v')
    const fromPath =
      segments[0] === 'embed' || segments[0] === 'shorts' || segments[0] === 'live'
        ? segments[1]
        : undefined
    const id = (fromQuery ?? fromPath ?? '').trim()
    return YOUTUBE_ID.test(id) ? { provider: 'youtube', id } : null
  }

  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    /* `player.vimeo.com/video/<id>`, `vimeo.com/<id>`, and the unlisted form
       `vimeo.com/<id>/<hash>` — the hash is dropped, so an unlisted video
       simply will not play rather than having its private key stored. */
    const id = (segments[0] === 'video' ? segments[1] : segments[0]) ?? ''
    return VIMEO_ID.test(id) ? { provider: 'vimeo', id } : null
  }

  return null
}

/**
 * One block, or `null` if it cannot be trusted to render.
 *
 * Every branch rebuilds the object from validated pieces rather than returning
 * the input with a cast. That is what keeps an extra key an older editor wrote
 * — or one a crafted request added — out of the value the renderers see.
 */
export function parseBlock(raw: unknown): Block | null {
  if (!isObject(raw)) return null

  switch (raw.t) {
    case 'tldr': {
      const items = strArray(raw.items, 140)
      // Exactly three. The tuple type promises it and the rail renders three.
      if (items.length !== 3) return null
      return { t: 'tldr', items: [items[0], items[1], items[2]] }
    }

    case 'h': {
      const text = str(raw.text, SHORT_MAX)
      return text ? { t: 'h', text } : null
    }

    case 'p': {
      const text = str(raw.text)
      return text ? { t: 'p', text } : null
    }

    case 'menu': {
      const oldPath = str(raw.old, SHORT_MAX)
      const newPath = str(raw.new, SHORT_MAX)
      // Always a pair: half a pair sends half the readership hunting.
      return oldPath && newPath ? { t: 'menu', old: oldPath, new: newPath } : null
    }

    case 'table': {
      const head = strArray(raw.head, 120)
      const caption = str(raw.caption, SHORT_MAX)
      if (head.length !== 3 || !caption) return null
      if (!Array.isArray(raw.rows)) return null

      const rows: (readonly [string, string, string])[] = []
      for (const row of raw.rows) {
        if (!Array.isArray(row) || row.length !== 3) continue
        /* Cells are read with `?? ''` rather than dropped when blank: an empty
           cell is a legitimate "not applicable", and dropping the row would
           silently delete a comparison the editor made on purpose. The row is
           refused only when its first cell is empty, because that one is the
           row header a screen reader announces. */
        const cells = row.map((c) => (typeof c === 'string' ? c.trim().slice(0, SHORT_MAX) : ''))
        if (!cells[0]) continue
        rows.push([cells[0], cells[1], cells[2]] as const)
      }
      if (rows.length < 1) return null

      return { t: 'table', head: [head[0], head[1], head[2]], rows, caption }
    }

    case 'callout': {
      const label = str(raw.label, 120)
      const text = str(raw.text)
      return label && text ? { t: 'callout', label, text } : null
    }

    case 'compare': {
      const beforeLabel = str(raw.beforeLabel, 120)
      const afterLabel = str(raw.afterLabel, 120)
      const caption = str(raw.caption, SHORT_MAX)
      if (!beforeLabel || !afterLabel || !caption) return null
      return {
        t: 'compare',
        beforeLabel,
        afterLabel,
        caption,
        /* Both optional and independently so. The slider renders nothing until
           it has both, which is how a half-uploaded comparison shows as absent
           rather than as a broken image.

           A legacy absolute Storage URL in these fields is dropped, not
           carried: it names the old project, and writing it back would put a
           host-coupled URL into a *new* row. The Task 12 migration script
           resolves real legacy URLs to assets before the import. */
        beforeAssetId: parseAssetId(raw.beforeAssetId),
        afterAssetId: parseAssetId(raw.afterAssetId),
      }
    }

    case 'checklist': {
      const label = str(raw.label, 120)
      const items = strArray(raw.items, SHORT_MAX)
      if (!label || items.length < 1) return null
      return { t: 'checklist', label, items }
    }

    case 'figure': {
      const caption = str(raw.caption, SHORT_MAX)
      if (!caption) return null
      return {
        t: 'figure',
        caption,
        alt: optStr(raw.alt, SHORT_MAX),
        assetId: parseAssetId(raw.assetId),
      }
    }

    case 'embed': {
      const caption = str(raw.caption, SHORT_MAX)
      const id = typeof raw.id === 'string' ? raw.id.trim() : ''
      if (!caption) return null
      if (raw.provider === 'youtube' && YOUTUBE_ID.test(id)) {
        return { t: 'embed', provider: 'youtube', id, caption }
      }
      if (raw.provider === 'vimeo' && VIMEO_ID.test(id)) {
        return { t: 'embed', provider: 'vimeo', id, caption }
      }
      return null
    }

    default:
      return null
  }
}


export type ParsedBlocks = {
  readonly blocks: readonly Block[]
  /** How many were refused. The admin API returns it so a drop is visible. */
  readonly dropped: number
}

export function parseBlocks(raw: unknown): ParsedBlocks {
  if (!Array.isArray(raw)) return { blocks: [], dropped: 0 }

  const blocks: Block[] = []
  let dropped = 0
  /* Capped well above the spec's 16 rather than at it, because this runs on
     drafts too and an editor mid-restructure may legitimately hold more than a
     finished article allows. The cap is here to bound the work, not to enforce
     editorial length — `validateArticleShape` does that. */
  for (const item of raw.slice(0, 64)) {
    const block = parseBlock(item)
    if (block) blocks.push(block)
    else dropped += 1
  }
  return { blocks, dropped }
}

export function parseTopic(raw: unknown): TopicId | null {
  return typeof raw === 'string' && TOPIC_IDS.has(raw) ? (raw as TopicId) : null
}

export function parseLevel(raw: unknown): LevelId | null {
  return typeof raw === 'string' && LEVEL_IDS.has(raw) ? (raw as LevelId) : null
}

export function parseArchetype(raw: unknown): Archetype | null {
  return typeof raw === 'string' && ARCHETYPES.has(raw) ? (raw as Archetype) : null
}

export function parseStatus(raw: unknown): ArticleStatus {
  return raw === 'published' ? 'published' : 'draft'
}

/**
 * A URL-safe id derived from a title, for the `/blog/<id>` segment.
 *
 * Vietnamese is decomposed and stripped rather than transliterated by table:
 * NFD splits `ế` into `e` + two combining marks, the mark range goes, and `e`
 * is left. `đ` has no decomposition and is the one letter that needs naming.
 *
 * The result is not guaranteed unique — the API checks the store and appends a
 * suffix. Doing it here would need a query, and this has to stay pure so the
 * editor can show the slug as the title is typed.
 */
export function slugify(title: string): string {
  return title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '')
}

/**
 * The ids a route already owns. An article may not take one.
 *
 * `/blog/setup` is a static sibling segment and `/blog/admin` now is too;
 * Next matches both before `[id]`, so an article saved under either id would
 * be unreachable — a 200 page nobody can open. Refused at save time, where the
 * editor can still change the title, rather than discovered as a dead link.
 */
export const RESERVED_IDS: ReadonlySet<string> = new Set(['setup', 'admin', 'new'])

/**
 * The editorial rules that bind a *finished* article, checked on publish only.
 *
 * These are the countable half of `ARTICLE-SPEC.md` — the same assertions
 * `article-spec.test.ts` makes over the authored catalogue. A draft is exempt
 * from all of them by design: an editor building an article reaches eight
 * blocks on the way to twelve, and a save that refused everything until the
 * shape was final would make the tool unusable for the thing it is for.
 *
 * Returns codes, not sentences. The client looks each one up under
 * `lab.admin.errors.*`, which is what keeps the message out of the API and
 * translatable — the same rule the community routes follow.
 */
export function validateArticleShape(article: Article): readonly string[] {
  const problems: string[] = []
  const types = article.blocks.map((b) => b.t)

  if (article.blocks.length < 8) problems.push('tooFewBlocks')
  if (article.blocks.length > 16) problems.push('tooManyBlocks')
  if (article.dek.length > 220) problems.push('dekTooLong')

  if (types[0] !== 'tldr') problems.push('mustOpenWithTldr')
  if (types[1] !== 'p') problems.push('tldrNeedsContext')
  if (types.indexOf('h') <= 1) problems.push('headingTooEarly')

  const last = types.at(-1)
  if (last !== 'checklist' && last !== 'figure') problems.push('mustCloseWithChecklistOrFigure')

  for (let i = 1; i < types.length; i += 1) {
    // A run of menu pairs is the one sanctioned repetition.
    if (types[i] !== 'menu' && types[i] === types[i - 1]) {
      problems.push('repeatedBlock')
      break
    }
  }

  for (const b of article.blocks) {
    if (b.t === 'menu' && (!b.old.includes(' → ') || !b.new.includes(' → '))) {
      problems.push('menuSeparator')
      break
    }
  }

  for (const b of article.blocks) {
    if (b.t === 'table' && (b.rows.length < 3 || b.rows.length > 6)) {
      problems.push('tableRows')
      break
    }
  }

  for (const b of article.blocks) {
    if (b.t === 'checklist' && (b.items.length < 3 || b.items.length > 6)) {
      problems.push('checklistItems')
      break
    }
  }

  for (const b of article.blocks) {
    if (b.t !== 'compare') continue
    if (/^(trước|sau|before|after)$/i.test(b.beforeLabel) || /^(trước|sau|before|after)$/i.test(b.afterLabel)) {
      problems.push('compareLabels')
      break
    }
  }

  for (const b of article.blocks) {
    if (b.t === 'callout' && /^(lưu ý|chú ý|note)$/i.test(b.label.trim())) {
      problems.push('calloutLabel')
      break
    }
  }

  // §4: both read as marketing copy, and this is a reference product.
  const prose = JSON.stringify(article)
  if (/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(prose)) problems.push('emoji')
  if (prose.includes('!')) problems.push('exclamation')

  return problems
}

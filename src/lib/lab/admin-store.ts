import 'server-only'
import { contentAdmin } from '@/lib/supabase/server'
import { devDelete, devGet, devHasId, devList, devUpsert, isDevStore } from './dev-store'
import {
  parseArchetype,
  parseBlocks,
  parseLevel,
  parseStatus,
  parseTopic,
  RESERVED_IDS,
  slugify,
} from './parse'
import { parseKind, parseMeta } from './meta'
import type { Article, ArticleRecord, ArticleStatus } from './types'

/**
 * The admin's view of the article store: every row, drafts included.
 *
 * Every read branches on `isDevStore()` first, which is how the same editor
 * screen works against Supabase and against a JSON file on a laptop. The
 * branch is here rather than in the routes so there is one of it: a route that
 * forgot the check would answer `notConfigured` offline, which is exactly the
 * inert editor this store was added to fix.
 *
 * Separate from `data.ts` and deliberately uncached. `data.ts` is the reading
 * path — cached, published-only, anon columns. This one runs under the
 * service-role client behind `requireAdmin()`, and an editor who just pressed
 * save must see what they saved, not a page of a 60-second cache. Mixing the
 * two into one module with a `includeDrafts` flag is how a draft ends up in a
 * reader's feed; they are kept apart so that flag cannot exist.
 */

const ADMIN_COLUMNS =
  'id, status, kind, topic, level, archetype, read, title, dek, blocks, meta, updated_at, updated_by'

type Row = Record<string, unknown>

function toRecord(row: Row): ArticleRecord | null {
  const id = typeof row.id === 'string' ? row.id.trim() : ''
  const title = typeof row.title === 'string' ? row.title.trim() : ''
  const topic = parseTopic(row.topic)
  const level = parseLevel(row.level)
  const archetype = parseArchetype(row.archetype)
  /* An admin row is shown even when its body is empty or its topic has since
     been removed from `TOPICS` — this is the screen where such a row gets
     fixed, so hiding it would strand it. Only an unusable id or title is
     refused, because neither can be repaired from the list. */
  if (!id || !title) return null

  const { blocks } = parseBlocks(row.blocks)

  return {
    id,
    /* An unreadable kind is shown as an article here rather than hidden: this
       is the screen where it gets fixed. The reading path refuses it. */
    kind: parseKind(row.kind) ?? 'article',
    topic: topic ?? 'setup',
    level: level ?? 'newbie',
    archetype: archetype ?? 'explainer',
    read: typeof row.read === 'string' ? row.read : '',
    title,
    dek: typeof row.dek === 'string' ? row.dek : '',
    blocks,
    meta: parseMeta(row.meta).meta,
    status: parseStatus(row.status),
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : '',
    updatedBy: typeof row.updated_by === 'string' ? row.updated_by : null,
  }
}

export async function listArticleRecords(): Promise<ArticleRecord[]> {
  if (isDevStore()) return devList()

  const { data, error } = await contentAdmin()
    .from('lab_articles')
    .select(ADMIN_COLUMNS)
    .order('updated_at', { ascending: false })

  if (error || !Array.isArray(data)) throw new Error(error?.message ?? 'listFailed')
  return data.map(toRecord).filter((r): r is ArticleRecord => r !== null)
}

export async function getArticleRecord(id: string): Promise<ArticleRecord | null> {
  if (isDevStore()) return devGet(id)

  const { data, error } = await contentAdmin()
    .from('lab_articles')
    .select(ADMIN_COLUMNS)
    .eq('id', id)
    .maybeSingle()

  /* `null` is "no such row" and nothing else. Answering it for an error too
     made a restricted content project read as a deleted article: every editor
     opening any page was told it no longer existed. */
  if (error) throw new Error(`lab_articles: ${error.message}`)
  if (!data) return null
  return toRecord(data as Row)
}

export type NormalisedWrite = {
  article: Article
  status: ArticleStatus
  /** Blocks the parser refused. Returned to the editor so a silent drop is
      impossible to miss — see `parse.ts`. */
  dropped: number
  /** Metadata entries `parseMeta` refused — a bad URL, an unknown concept, an
      author name that looked like an address. Reported the same way. */
  droppedMeta: number
}

/**
 * The row shape a write produces, from an untrusted body.
 *
 * Every field is re-derived rather than spread: the body is JSON an admin's
 * browser sent, and an admin is trusted to publish, not trusted to have sent
 * well-formed JSON. `blocks` goes through `parseBlocks`, which is the only
 * place a block's shape is checked before it reaches a renderer.
 */
export function normaliseWrite(id: string, body: Record<string, unknown>): NormalisedWrite | null {
  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 200) : ''
  if (!title) return null

  const topic = parseTopic(body.topic)
  const level = parseLevel(body.level)
  const archetype = parseArchetype(body.archetype)
  if (!topic || !level || !archetype) return null

  /* Absent means an ordinary article — the shape every editor sent before
     knowledge pages existed. Present and unknown is refused, not defaulted:
     guessing would publish a page on a surface nobody chose. */
  const kind = body.kind === undefined ? 'article' : parseKind(body.kind)
  if (!kind) return null

  const { blocks, dropped } = parseBlocks(body.blocks)
  const { meta, dropped: droppedMeta } = parseMeta(body.meta)

  return {
    article: {
      id,
      kind,
      topic,
      level,
      archetype,
      read: typeof body.read === 'string' ? body.read.trim().slice(0, 40) : '',
      title,
      dek: typeof body.dek === 'string' ? body.dek.trim().slice(0, 400) : '',
      blocks,
      meta,
    },
    status: parseStatus(body.status),
    dropped,
    droppedMeta,
  }
}

/**
 * A slug nothing else owns.
 *
 * The base comes from the title, so two articles about the same subject
 * collide often enough to be worth handling rather than erroring on — the
 * editor would otherwise have to invent a different title to get a different
 * URL. `-2`, `-3` … up to a bound, then a timestamp, because a loop with no
 * ceiling against a database is a way to hang a request.
 */
export async function uniqueArticleId(title: string): Promise<string> {
  const base = slugify(title) || `bai-viet-${Date.now()}`

  /* One loop, two backends. `taken` is the only thing that differs, so the
     suffix rule cannot drift between local development and production. */
  const client = isDevStore() ? null : contentAdmin()
  const taken = async (id: string): Promise<boolean> => {
    if (!client) return devHasId(id)
    const { data } = await client.from('lab_articles').select('id').eq('id', id).maybeSingle()
    return Boolean(data)
  }

  for (let n = 1; n <= 20; n += 1) {
    const candidate = n === 1 ? base : `${base}-${n}`
    if (RESERVED_IDS.has(candidate)) continue
    if (!(await taken(candidate))) return candidate
  }

  return `${base}-${Date.now().toString(36)}`
}

/**
 * The three writes, each branching once on the backend.
 *
 * They throw rather than returning an error union, and the routes turn a throw
 * into a 502. That keeps the branch and the Supabase error handling in this
 * module instead of duplicated across `POST`, `PATCH` and `DELETE` — the
 * version where each route spoke to `contentAdmin()` directly had three
 * copies of the same `if (error) console.error(...)` and would have needed
 * three copies of the dev-store check beside them.
 */

function devRecord(article: Article, status: ArticleStatus, email: string | null): ArticleRecord {
  return { ...article, status, updatedAt: new Date().toISOString(), updatedBy: email }
}

/** The row shape, shared by insert and update so the two cannot drift. */
function row(article: Article, status: ArticleStatus, email: string) {
  return {
    status,
    kind: article.kind,
    topic: article.topic,
    level: article.level,
    archetype: article.archetype,
    read: article.read,
    title: article.title,
    dek: article.dek,
    blocks: article.blocks,
    meta: article.meta,
    updated_at: new Date().toISOString(),
    updated_by: email,
  }
}

/**
 * Both writes answer the row's new `updated_at` — the version the editor names
 * on its next save. Read back from the database rather than echoed from
 * `row()`: PostgREST formats a timestamp its own way (`+00:00`, microseconds),
 * and the route compares versions as strings, so an echoed `toISOString()`
 * would make the first save after every create read as stale.
 */
export async function insertArticleRecord(
  article: Article,
  status: ArticleStatus,
  email: string,
): Promise<string> {
  if (isDevStore()) {
    const record = devRecord(article, status, email)
    devUpsert(record)
    return record.updatedAt
  }

  const { data, error } = await contentAdmin()
    .from('lab_articles')
    .insert({ id: article.id, created_at: new Date().toISOString(), ...row(article, status, email) })
    .select('updated_at')
    .single()
  if (error || typeof data?.updated_at !== 'string') {
    console.error('[lab] insert failed:', JSON.stringify(error))
    throw new Error('saveFailed')
  }
  return data.updated_at
}

/** Thrown when the row the editor is saving is no longer there. */
export class ArticleMissingError extends Error {
  readonly code = 'notFound'
}

/** Thrown when the row has been saved since the editor opened it. */
export class StaleEditError extends Error {
  readonly code = 'staleEdit'
}

/**
 * Write the article, but only over the version the editor opened.
 *
 * `expectedUpdatedAt` is that version. A row saved since — by another editor,
 * or by the same one in a second tab — matches nothing and is refused as
 * `StaleEditError`, rather than having this save silently revert that one.
 * The route compares the version before it writes; the filter here closes the
 * window between that read and this write. `updated_at` is NOT NULL on
 * `lab_articles`, so unlike a product there is no never-edited `null` case.
 */
export async function updateArticleRecord(
  article: Article,
  status: ArticleStatus,
  email: string,
  expectedUpdatedAt: string,
): Promise<string> {
  if (isDevStore()) {
    /* An update to an id the store does not hold is an upsert here rather than
       an error. The dev store is seeded lazily from the compiled catalogue, so
       the first edit to one of those three articles is genuinely its first
       write to the file. */
    const current = devGet(article.id)
    if (current && current.updatedAt !== expectedUpdatedAt) {
      throw new StaleEditError(`lab_articles ${article.id} was saved since it was opened`)
    }
    const record = devRecord(article, status, email)
    devUpsert(record)
    return record.updatedAt
  }

  /* `.select('id')` is what makes a missing row an error.

     An `update ... where id = ?` that matches nothing is a *success* in
     PostgREST: no error, zero rows, and this used to return normally. So an
     editor with the article open in a second tab, or one saving after somebody
     else deleted it, got "Saved" — and the route went on to invalidate the
     blog's cache for a write that never happened. Asking for the updated row
     back turns the empty result into something we can refuse. */
  const { data, error } = await contentAdmin()
    .from('lab_articles')
    .update(row(article, status, email))
    .eq('id', article.id)
    .eq('updated_at', expectedUpdatedAt)
    .select('id, updated_at')
  if (error) {
    console.error('[lab] update failed:', JSON.stringify(error))
    throw new Error('saveFailed')
  }
  const saved = data?.[0] as { updated_at?: unknown } | undefined
  if (!saved) {
    /* Nothing matched: the row went, or it moved on. Asked again rather than
       guessed, so a deletion still reads as one. A failed re-read throws, and
       is a failed save — not evidence of either. */
    if (await getArticleRecord(article.id)) {
      throw new StaleEditError(`lab_articles ${article.id} was saved since it was opened`)
    }
    throw new ArticleMissingError(`lab_articles ${article.id} no longer exists`)
  }
  if (typeof saved.updated_at !== 'string') throw new Error('saveFailed')
  return saved.updated_at
}

export async function deleteArticleRecord(id: string): Promise<void> {
  if (isDevStore()) {
    devDelete(id)
    return
  }

  const { error } = await contentAdmin().from('lab_articles').delete().eq('id', id)
  if (error) {
    console.error('[lab] delete failed:', JSON.stringify(error))
    throw new Error('deleteFailed')
  }
}

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
  'id, status, topic, level, archetype, read, title, dek, blocks, updated_at, updated_by'

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
    topic: topic ?? 'setup',
    level: level ?? 'newbie',
    archetype: archetype ?? 'explainer',
    read: typeof row.read === 'string' ? row.read : '',
    title,
    dek: typeof row.dek === 'string' ? row.dek : '',
    blocks,
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

  if (error || !data) return null
  return toRecord(data as Row)
}

/**
 * The row shape a write produces, from an untrusted body.
 *
 * Every field is re-derived rather than spread: the body is JSON an admin's
 * browser sent, and an admin is trusted to publish, not trusted to have sent
 * well-formed JSON. `blocks` goes through `parseBlocks`, which is the only
 * place a block's shape is checked before it reaches a renderer.
 */
export type WritePayload = {
  topic: string
  level: string
  archetype: string
  read: string
  title: string
  dek: string
  blocks: unknown
  status: ArticleStatus
}

export type NormalisedWrite = {
  article: Article
  status: ArticleStatus
  /** Blocks the parser refused. Returned to the editor so a silent drop is
      impossible to miss — see `parse.ts`. */
  dropped: number
}

export function normaliseWrite(id: string, body: Record<string, unknown>): NormalisedWrite | null {
  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 200) : ''
  if (!title) return null

  const topic = parseTopic(body.topic)
  const level = parseLevel(body.level)
  const archetype = parseArchetype(body.archetype)
  if (!topic || !level || !archetype) return null

  const { blocks, dropped } = parseBlocks(body.blocks)

  return {
    article: {
      id,
      topic,
      level,
      archetype,
      read: typeof body.read === 'string' ? body.read.trim().slice(0, 40) : '',
      title,
      dek: typeof body.dek === 'string' ? body.dek.trim().slice(0, 400) : '',
      blocks,
    },
    status: parseStatus(body.status),
    dropped,
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
    topic: article.topic,
    level: article.level,
    archetype: article.archetype,
    read: article.read,
    title: article.title,
    dek: article.dek,
    blocks: article.blocks,
    updated_at: new Date().toISOString(),
    updated_by: email,
  }
}

export async function insertArticleRecord(
  article: Article,
  status: ArticleStatus,
  email: string,
): Promise<void> {
  if (isDevStore()) {
    devUpsert(devRecord(article, status, email))
    return
  }

  const { error } = await contentAdmin()
    .from('lab_articles')
    .insert({ id: article.id, created_at: new Date().toISOString(), ...row(article, status, email) })
  if (error) {
    console.error('[lab] insert failed:', JSON.stringify(error))
    throw new Error('saveFailed')
  }
}

/** Thrown when the row the editor is saving is no longer there. */
export class ArticleMissingError extends Error {
  readonly code = 'notFound'
}

export async function updateArticleRecord(
  article: Article,
  status: ArticleStatus,
  email: string,
): Promise<void> {
  if (isDevStore()) {
    /* An update to an id the store does not hold is an upsert here rather than
       an error. The dev store is seeded lazily from the compiled catalogue, so
       the first edit to one of those three articles is genuinely its first
       write to the file. */
    devUpsert(devRecord(article, status, email))
    return
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
    .select('id')
  if (error) {
    console.error('[lab] update failed:', JSON.stringify(error))
    throw new Error('saveFailed')
  }
  if (!data || data.length === 0) {
    throw new ArticleMissingError(`lab_articles ${article.id} no longer exists`)
  }
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

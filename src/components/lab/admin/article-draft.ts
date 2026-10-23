import { parseMeta } from '@/lib/lab/meta'
import { parseBlock, parseBlocks, validateForPublish } from '@/lib/lab/parse'
import type {
  Archetype,
  Article,
  ArticleKind,
  ArticleStatus,
  Block,
  ContentRef,
} from '@/lib/lab/types'
import { emptyBlock, type AssetField } from './block-editor'
import { emptyMetaDraft, toMetaDraft, toMetaPayload, type MetaDraft } from './meta-editor'

/**
 * The article editor's draft, and every rule about what lands on it.
 *
 * Pure and outside the component so the rules can be executed in a test: the
 * suite runs in Node with no DOM, and every defect these functions fix was a
 * question of which copy of the draft an answer was applied to — an upload
 * spreading the block as it was when the file was picked, a save's answer
 * replacing what was typed while it was out, an article opened mid-save being
 * overwritten by the one that was saving.
 */

/**
 * One block and the key it renders under.
 *
 * Keyed by identity, not position. Index keys kept each image slot's state on
 * whichever block next sat at that index — another article's block, or the
 * neighbour of one just removed — and gave an upload no way to find its block
 * again once the list had moved.
 */
export type DraftBlock = { readonly key: number; readonly block: Block }

export type DraftFields = {
  kind: ArticleKind
  topic: Article['topic']
  level: Article['level']
  archetype: Archetype
  read: string
  title: string
  dek: string
  blocks: readonly DraftBlock[]
  meta: MetaDraft
}

export type Draft = DraftFields & {
  /** Which opening of an article this is: new every time a draft is built
      from the server or started blank. A late answer compares this, never
      the id — a new article's id is `null` however many times it is begun. */
  session: number
  id: string | null
  /** The row's `updated_at` when it was opened or last saved, named on save
      as `expectedUpdatedAt`. A row saved elsewhere since answers 409
      `staleEdit` instead of being reverted. Empty until the row exists. */
  version: string
  status: ArticleStatus
  /** Bumped by every edit. `saved` is the revision the stored row matches, so
      the two differ exactly when there is something to lose. */
  rev: number
  saved: number
}

/** The stored article and its version, from a read or from a save's answer. */
export type StoredArticle = Article & { status: ArticleStatus; updatedAt: string }

let counter = 0
const next = () => (counter += 1)
export const nextKey = next

const keyed = (block: Block, key = next()): DraftBlock => ({ key, block })

/** `keys` reuses the keys of the blocks this row was saved from, by position. */
export function asDraft(a: StoredArticle, keys?: readonly number[]): Draft {
  return {
    session: next(),
    id: a.id,
    version: a.updatedAt,
    status: a.status,
    kind: a.kind,
    topic: a.topic,
    level: a.level,
    archetype: a.archetype,
    read: a.read,
    title: a.title,
    dek: a.dek,
    blocks: a.blocks.map((b, i) => keyed(b, keys?.[i])),
    meta: toMetaDraft(a.meta),
    rev: 0,
    saved: 0,
  }
}

export const blankDraft = (): Draft => ({
  session: next(),
  id: null,
  version: '',
  status: 'draft',
  kind: 'article',
  topic: 'setup',
  level: 'newbie',
  archetype: 'explainer',
  read: '',
  title: '',
  dek: '',
  blocks: [],
  meta: emptyMetaDraft(),
  rev: 0,
  saved: 0,
})

export const isDirty = (d: Draft | null): boolean => !!d && d.rev !== d.saved

/** An edit: the fields change and the revision moves on. */
export const edited = (d: Draft, patch: Partial<DraftFields>): Draft => ({
  ...d,
  ...patch,
  rev: d.rev + 1,
})

export const addBlock = (d: Draft, type: Block['t']): Draft =>
  edited(d, { blocks: [...d.blocks, keyed(emptyBlock(type))] })

/** A new block at `at`, under a key the caller chose so it can open it. */
export function insertBlock(d: Draft, type: Block['t'], at: number, key: number): Draft {
  const i = Math.max(0, Math.min(at, d.blocks.length))
  const blocks = [...d.blocks]
  blocks.splice(i, 0, keyed(emptyBlock(type), key))
  return edited(d, { blocks })
}

/** Which image fields each block type has. */
const ASSET_FIELDS: Partial<Record<Block['t'], readonly AssetField[]>> = {
  figure: ['assetId'],
  compare: ['beforeAssetId', 'afterAssetId'],
}

/**
 * An upload's result, or a cleared image, merged into the block as it is now.
 *
 * Only the one field changes. Spreading the block captured when the file was
 * picked wrote back everything as it was then: a comparison's second upload
 * erased the first, and a caption typed during the upload was reverted. An
 * answer for an article no longer open, or for a block since removed, is
 * dropped rather than landing on whatever now has its place.
 */
export function withAsset(
  d: Draft | null,
  session: number,
  key: number,
  field: AssetField,
  assetId: string | undefined,
): Draft | null {
  if (!d || d.session !== session) return d
  const at = d.blocks.findIndex((b) => b.key === key)
  if (at === -1) return d
  const { block } = d.blocks[at]
  if (!ASSET_FIELDS[block.t]?.includes(field)) return d
  const blocks = d.blocks.map((b, i) =>
    i === at ? { key, block: { ...block, [field]: assetId } as Block } : b,
  )
  return edited(d, { blocks })
}

/** The POST/PATCH body. The route ignores `expectedUpdatedAt` on a create. */
export const savePayload = (d: Draft, status: ArticleStatus) => ({
  kind: d.kind,
  topic: d.topic,
  level: d.level,
  archetype: d.archetype,
  read: d.read,
  title: d.title,
  dek: d.dek,
  blocks: d.blocks.map((b) => b.block),
  meta: toMetaPayload(d.meta, d.kind),
  status,
  expectedUpdatedAt: d.version,
})

/**
 * The draft once a save has answered with the stored row.
 *
 * `sent` is the draft as it was when Save was pressed. The fields stay live
 * during the round trip, so the draft on screen may have moved on: an
 * untouched one is rebuilt from what was stored — the parser trims, cuts and
 * drops without always counting it, and the screen should show what was kept
 * — while a newer one keeps its edits, takes the new id, status and version,
 * and stays dirty, which it is. Another article's draft is left alone.
 */
export function afterSave(current: Draft | null, sent: Draft, stored: StoredArticle): Draft | null {
  if (!current || current.session !== sent.session) return current
  if (current.rev !== sent.rev) {
    return {
      ...current,
      id: stored.id,
      version: stored.updatedAt,
      status: stored.status,
      saved: sent.rev,
    }
  }
  return { ...asDraft(stored, carriedKeys(sent.blocks, stored.blocks)), session: current.session }
}

/**
 * A block as the parser would store it, compared without key order: jsonb
 * sorts an object's keys, so the stored copy need not list them as sent.
 * Parsing both sides is safe because the parser is idempotent.
 */
const canonical = (block: Block) =>
  JSON.stringify(parseBlock(block), (_k, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)))
      : v,
  )

/**
 * The key each stored block takes over from the block it was saved from, so
 * an upload still running finds its slot when it answers.
 *
 * The parser only removes blocks and never reorders them, so each stored block
 * is the next sent block that parses to it. Matching by position instead gave
 * every block after a dropped one its neighbour's key — or, as first written,
 * new keys for all of them, and an upload in flight was silently discarded.
 */
export function carriedKeys(sent: readonly DraftBlock[], stored: readonly Block[]): number[] {
  const keys: number[] = []
  let from = 0
  for (const block of stored) {
    const want = canonical(block)
    let at = from
    while (at < sent.length && canonical(sent[at].block) !== want) at += 1
    if (at < sent.length) {
      keys.push(sent[at].key)
      from = at + 1
    } else {
      keys.push(next())
    }
  }
  return keys
}

/**
 * The publish rules for the draft on screen, as the route will apply them.
 *
 * Computed here rather than waiting for a save, so a blank article does not
 * read "Ready to publish" and switching kind shows the other kind's rules at
 * once. The same parsers the route runs, then the same rules — the route
 * stays the gate; this is the checklist. Unknown links are the one thing only
 * the server can know, so they come from its last answer.
 */
export function publishProblems(d: Draft, unknownRefs: readonly ContentRef[]): string[] {
  const article: Article = {
    id: d.id ?? '',
    kind: d.kind,
    topic: d.topic,
    level: d.level,
    archetype: d.archetype,
    read: d.read.trim(),
    title: d.title.trim(),
    dek: d.dek.trim(),
    blocks: parseBlocks(d.blocks.map((b) => b.block)).blocks,
    meta: parseMeta(toMetaPayload(d.meta, d.kind)).meta,
  }
  return [...validateForPublish(article), ...(unknownRefs.length > 0 ? ['relatedUnknown'] : [])]
}

type ClickLike = Pick<
  MouseEvent,
  'button' | 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey' | 'defaultPrevented'
>
type LinkLike = Pick<Element, 'getAttribute' | 'hasAttribute'>

/**
 * Whether a click on this link replaces the editor in this tab.
 *
 * That is the case `beforeunload` cannot see: the admin header's links are
 * client-side navigations, which unmount the editor without unloading the
 * page. A click that opens a new tab or a download leaves the draft where it
 * is and needs no question.
 */
export function leavesInPlace(e: ClickLike, link: LinkLike): boolean {
  if (e.defaultPrevented || e.button !== 0) return false
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false
  if (link.hasAttribute('download')) return false
  const target = link.getAttribute('target')
  return !target || target === '_self'
}

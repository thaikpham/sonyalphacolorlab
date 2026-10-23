'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useAdminSession } from '@/components/admin-ui/session'
import { MAX_UPLOAD_BYTES } from '@/lib/recipes/upload-limits'
import type { Article, ArticleKind, ArticleRecord, ArticleStatus, Block, ContentRef } from '@/lib/lab/types'
import type { AssetField, UploadFn } from './block-editor'
import type { RefOptions } from './meta-editor'
import {
  afterSave,
  asDraft,
  blankDraft,
  edited,
  insertBlock,
  isDirty,
  leavesInPlace,
  nextKey,
  publishProblems,
  savePayload,
  withAsset,
  type Draft,
  type DraftFields,
  type StoredArticle,
} from './article-draft'

export type EditorBusy = '' | 'loading' | 'saving' | 'deleting'
export type EditorStatus = { kind: 'ok' | 'err'; msg: string } | null
export type ArticleEditor = {
  draft: Draft | null
  dirty: boolean
  busy: EditorBusy
  status: EditorStatus
  /** When the last successful save answered, for the save line. */
  savedAt: Date | null
  previews: Readonly<Record<string, string>>
  refs: RefOptions | null
  refsFailed: boolean
  unknownRefs: readonly ContentRef[]
  problems: string[]
  codeMessage: (code: string) => string
  edit: (patch: Partial<DraftFields>) => void
  loadArticle: (id: string) => Promise<void>
  startNew: (kind?: ArticleKind) => void
  save: (nextStatus: ArticleStatus) => Promise<StoredArticle | null>
  remove: () => Promise<boolean>
  upload: UploadFn
  setBlock: (key: number, block: Block) => void
  setAsset: (session: number, key: number, field: AssetField, assetId: string | undefined) => void
  insertBlock: (type: Block['t'], at: number) => number
  removeBlock: (key: number) => void
  moveBlock: (key: number, by: -1 | 1) => void
}

/**
 * One article in the editor: reading it, saving it, publishing it, deleting
 * it, its pictures and its link picker. Lifted out of `article-admin.tsx` so
 * the page-shaped editor at /blog/<id>/edit and the list screen run the same
 * code. What lands on the draft is still `article-draft.ts`.
 */
export function useArticleEditor(options: {
  /** After a save that stored a row: the list refreshes, the route moves to the id. */
  onStored?: (stored: StoredArticle, created: boolean) => void
  /** After a delete, successful or not — the caller re-reads whatever it lists. */
  onRemoved?: (deleted: boolean) => void
} = {}): ArticleEditor {
  const t = useTranslations('labAdmin')
  const { authed, bearer } = useAdminSession()
  const { onStored, onRemoved } = options

  const [draft, setDraft] = useState<Draft | null>(null)
  const [busy, setBusy] = useState<EditorBusy>('')
  const [status, setStatus] = useState<EditorStatus>(null)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  /* Asset id → short-lived signed URL. Editor-only state: the URLs expire in
     ten minutes and none of them is ever written into a block, which stores an
     asset UUID and nothing else. Refetched with the article, including after a
     save, so publishing a draft does not leave the editor looking at a preview
     that no longer describes where the picture lives. */
  const [previews, setPreviews] = useState<Readonly<Record<string, string>>>({})
  /* Ids the link picker may suggest, loaded once. A failure leaves the picker
     working as plain text fields — the server still checks every id on save. */
  const [refs, setRefs] = useState<RefOptions | null>(null)
  const [refsFailed, setRefsFailed] = useState(false)
  /* The references the server could not find, from the last read or save.
     Highlighted in the picker and listed under the spec checklist. */
  const [unknownRefs, setUnknownRefs] = useState<readonly ContentRef[]>([])
  /* The article the last click asked for. A read that answers after a later
     click is for a screen that has moved on; without this, two quick clicks
     could leave the editor showing the first while the list showed the
     second selected — and the next save wrote to the first. */
  const opening = useRef<string | null>(null)

  const dirty = isDirty(draft)

  /* An error code, never a sentence from the server. The routes answer with
     codes for the same reason the community ones do: a literal renders
     untranslated in the other locale and is invisible to the parity test. */
  const codeMessage = useCallback(
    (code: string) => (t.has(`errors.${code}` as never) ? t(`errors.${code}` as never) : code),
    [t],
  )

  useEffect(() => {
    let live = true
    ;(async () => {
      try {
        const res = await fetch('/api/admin/content-refs', { headers: authed() })
        const data = (await res.json()) as RefOptions & { error?: string }
        if (!live) return
        if (res.ok && Array.isArray(data.recipes)) setRefs(data)
        else setRefsFailed(true)
      } catch {
        if (live) setRefsFailed(true)
      }
    })()
    return () => {
      live = false
    }
  }, [authed])

  /* The guards against losing a draft. Nothing autosaves, so the browser's
     own prompt is what stands between an unsaved rewrite and a closed tab —
     and it never fires for a client-side navigation, which is what every link
     in the admin header is. Those are asked about here, in the capture phase
     on `window`, so the question comes before `<Link>` has routed anywhere.
     Browser Back is a `popstate` and cannot be held this way. */
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    const guard = (e: MouseEvent) => {
      const link = e.target instanceof Element ? e.target.closest('a[href]') : null
      if (!link || !leavesInPlace(e, link)) return
      if (window.confirm(t('discardConfirm'))) return
      e.preventDefault()
      e.stopPropagation()
    }
    window.addEventListener('beforeunload', warn)
    window.addEventListener('click', guard, true)
    return () => {
      window.removeEventListener('beforeunload', warn)
      window.removeEventListener('click', guard, true)
    }
  }, [dirty, t])

  /* Every edit goes through the updater, so it applies to the draft as it is
     when React runs it rather than to the copy this render closed over. */
  const edit = useCallback((patch: Partial<DraftFields>) => {
    setDraft((d) => (d ? edited(d, patch) : d))
  }, [])

  /* The saved article's id, not the draft's working copy. An asset belongs to
     a row, so there is nothing to attach one to until the article exists —
     which is why the slot disables itself rather than failing at the server. */
  const articleId = draft?.id ?? null

  const upload: UploadFn = useCallback(
    async (file) => {
      if (!articleId) {
        setStatus({ kind: 'err', msg: codeMessage('saveBeforeUpload') })
        return null
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        setStatus({ kind: 'err', msg: codeMessage('tooLarge') })
        return null
      }
      const form = new FormData()
      form.append('file', file)
      form.append('articleId', articleId)
      try {
        const res = await fetch('/api/admin/articles/upload', {
          method: 'POST',
          /* No `Content-Type` here on purpose: the browser has to set it
             itself so the multipart boundary matches the body it generated. */
          headers: bearer(),
          body: form,
        })
        /* The platform's own 413 is plain text, so it is read by status:
           parsing it as JSON would report "upload failed" for a file that is
           simply too large. The route keeps 413 for bytes alone. */
        if (res.status === 413) {
          setStatus({ kind: 'err', msg: codeMessage('tooLarge') })
          return null
        }
        const data = (await res.json()) as {
          assetId?: string
          previewUrl?: string
          error?: string
        }
        if (!res.ok || !data.assetId || !data.previewUrl) {
          setStatus({ kind: 'err', msg: codeMessage(data.error ?? 'uploadFailed') })
          return null
        }
        setPreviews((p) => ({ ...p, [data.assetId as string]: data.previewUrl as string }))
        return { assetId: data.assetId, previewUrl: data.previewUrl }
      } catch {
        setStatus({ kind: 'err', msg: codeMessage('uploadFailed') })
        return null
      }
    },
    [bearer, articleId, codeMessage],
  )

  /**
   * Re-read the signed previews for one article.
   *
   * Merged rather than replaced: an image uploaded while the save was out is
   * not in the stored row yet, and replacing the map would blank its slot.
   */
  async function refreshPreviews(id: string) {
    try {
      const res = await fetch(`/api/admin/articles/${id}`, { headers: authed() })
      if (!res.ok) return
      const data = (await res.json()) as { previews?: Record<string, string> }
      setPreviews((p) => ({ ...p, ...(data.previews ?? {}) }))
    } catch {
      /* A stale preview is a cosmetic problem and the save already succeeded.
         Reporting a failure here would tell the editor their article did not
         save, which would be false. */
    }
  }

  /**
   * Read one article into the editor. Never asks about unsaved changes —
   * the caller does, from the click that knows the current answer. A save
   * that reloaded through the asking version asked from a stale closure, and
   * offered to "discard" an article that had just been saved.
   */
  async function loadArticle(id: string) {
    opening.current = id
    setBusy('loading')
    setStatus(null)
    try {
      const res = await fetch(`/api/admin/articles/${id}`, { headers: authed() })
      const data = (await res.json()) as {
        article?: ArticleRecord
        unknownRefs?: ContentRef[]
        previews?: Record<string, string>
        previewsFailed?: boolean
        error?: string
      }
      if (opening.current !== id) return
      if (!res.ok || !data.article) {
        setStatus({ kind: 'err', msg: codeMessage(data.error ?? 'loadFailed') })
        return
      }
      setDraft(asDraft(data.article))
      setUnknownRefs(data.unknownRefs ?? [])
      setPreviews(data.previews ?? {})
      /* The text opened; the image ledger did not answer. Said once, so the
         missing pictures are not read as links that expired. */
      if (data.previewsFailed) setStatus({ kind: 'err', msg: codeMessage('previewsFailed') })
    } catch {
      /* A network failure, or a platform error page that is not JSON. */
      if (opening.current === id) setStatus({ kind: 'err', msg: codeMessage('loadFailed') })
    } finally {
      if (opening.current === id) setBusy('')
    }
  }

  function startNew(kind: ArticleKind = 'article') {
    opening.current = null
    /* Spread, not `edited()`: a blank knowledge page is not an unsaved change. */
    setDraft({ ...blankDraft(), kind })
    setPreviews({})
    setUnknownRefs([])
    setStatus(null)
  }

  /**
   * Save, and optionally publish.
   *
   * The two are one request because they are one row. `nextStatus` is what the
   * article becomes; the route refuses `published` when the spec problems are
   * non-empty and returns the list.
   *
   * The answer carries the stored row, which `afterSave` applies to the draft
   * as it is by then — not to `sent`, the copy this call closed over. That
   * copy used to be written back whole, reverting anything typed during the
   * round trip and marking it clean.
   */
  async function save(nextStatus: ArticleStatus) {
    if (!draft) return null
    const sent = draft
    setBusy('saving')
    setStatus(null)

    try {
      const creating = sent.id === null
      const res = await fetch(
        creating ? '/api/admin/articles' : `/api/admin/articles/${sent.id}`,
        {
          method: creating ? 'POST' : 'PATCH',
          headers: authed(),
          body: JSON.stringify(savePayload(sent, nextStatus)),
        },
      )
      const data = (await res.json()) as {
        ok?: boolean
        id?: string
        article?: Article & { status: ArticleStatus }
        updatedAt?: string
        unknownRefs?: ContentRef[]
        dropped?: number
        droppedMeta?: number
        error?: string
      }

      if (data.unknownRefs) setUnknownRefs(data.unknownRefs)

      /* The row was written whenever the answer carries it — including an
         asset failure after the write, where keeping the old version would
         refuse the next save as stale. */
      const stored: StoredArticle | null =
        data.article && data.updatedAt ? { ...data.article, updatedAt: data.updatedAt } : null
      if (stored) setDraft((d) => afterSave(d, sent, stored))

      if (!res.ok || !stored) {
        setStatus({ kind: 'err', msg: codeMessage(data.error ?? 'saveFailed') })
        return null
      }

      onStored?.(stored, creating)
      /* Read the previews back rather than trusting the ones in hand.
         Publishing moves an asset's bytes between buckets, so a signed URL
         taken before the save may point at the wrong copy. */
      await refreshPreviews(stored.id)

      setStatus({
        kind: 'ok',
        /* The dropped count is surfaced, not swallowed. A block the parser
           refused is gone from the row the moment this returns, and from the
           screen too once `afterSave` rebuilds it — an editor who is not told
           will find out by scrolling past a gap next week. */
        msg: data.dropped
          ? t('savedWithDropped', { n: data.dropped })
          : data.droppedMeta
            ? t('savedWithDroppedMeta', { n: data.droppedMeta })
            : creating
            ? t('created')
            : nextStatus === 'published' && sent.status !== 'published'
              ? t('published')
              : t('saved'),
      })
      setSavedAt(new Date())
      return stored
    } catch {
      setStatus({ kind: 'err', msg: codeMessage('saveFailed') })
      return null
    } finally {
      setBusy('')
    }
  }

  async function remove() {
    if (!draft?.id) return false
    setBusy('deleting')
    setStatus(null)
    try {
      const res = await fetch(`/api/admin/articles/${draft.id}`, {
        method: 'DELETE',
        headers: authed(),
      })
      const data = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok) {
        setStatus({ kind: 'err', msg: codeMessage(data.error ?? 'deleteFailed') })
        return false
      }
      opening.current = null
      setDraft(null)
      setStatus({ kind: 'ok', msg: t('deleted') })
      onRemoved?.(true)
      return true
    } catch {
      /* No readable answer, so no telling whether the row went. The caller
         re-reads the list so it shows whichever is true. */
      setStatus({ kind: 'err', msg: codeMessage('deleteFailed') })
      onRemoved?.(false)
      return false
    } finally {
      setBusy('')
    }
  }

  // --- block list operations, all immutable, all by key -------------------

  const setBlock = (key: number, block: Block) =>
    setDraft((d) =>
      d ? edited(d, { blocks: d.blocks.map((b) => (b.key === key ? { key, block } : b)) }) : d,
    )

  /* The session is the one this render shows, so an upload picked now and
     answering after another article has opened is dropped, not misfiled. */
  const setAsset = (session: number, key: number, field: AssetField, assetId: string | undefined) =>
    setDraft((d) => withAsset(d, session, key, field, assetId))

  /** A new block at `at`, under a key chosen before the update so the caller
      can open it at once. */
  function insertAt(type: Block['t'], at: number): number {
    const key = nextKey()
    setDraft((d) => (d ? insertBlock(d, type, at, key) : d))
    return key
  }

  const removeBlock = (key: number) =>
    setDraft((d) => (d ? edited(d, { blocks: d.blocks.filter((b) => b.key !== key) }) : d))

  /** Move by swapping with the neighbour — the only reorder an article needs,
      and the one that works with a keyboard without a drag surface. */
  const moveBlock = (key: number, by: -1 | 1) =>
    setDraft((d) => {
      if (!d) return d
      const i = d.blocks.findIndex((b) => b.key === key)
      const target = i + by
      if (i === -1 || target < 0 || target >= d.blocks.length) return d
      const blocks = [...d.blocks]
      ;[blocks[i], blocks[target]] = [blocks[target], blocks[i]]
      return edited(d, { blocks })
    })

  /* Shown always, not only on a failed publish, and computed from the draft
     on screen — see `publishProblems`. */
  const problems = useMemo(
    () => (draft ? publishProblems(draft, unknownRefs) : []),
    [draft, unknownRefs],
  )

  return {
    draft,
    dirty,
    busy,
    status,
    savedAt,
    previews,
    refs,
    refsFailed,
    unknownRefs,
    problems,
    codeMessage,
    edit,
    loadArticle,
    startNew,
    save,
    remove,
    upload,
    setBlock,
    setAsset,
    insertBlock: insertAt,
    removeBlock,
    moveBlock,
  }
}

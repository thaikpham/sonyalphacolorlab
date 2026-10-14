'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { useAdminSession } from '@/components/admin-ui/session'
import { LEVELS, TOPICS } from '@/lib/lab/articles'
import { ARCHETYPES } from '@/lib/lab/parse'
import type {
  Archetype,
  Article,
  ArticleKind,
  ArticleRecord,
  ArticleStatus,
  Block,
  ContentRef,
} from '@/lib/lab/types'
import { BLOCK_TYPES, BlockFields, type AssetField, type UploadFn } from './block-editor'
import { MetaEditor, type RefOptions } from './meta-editor'
import {
  addBlock as withNewBlock,
  afterSave,
  asDraft,
  blankDraft,
  edited,
  isDirty,
  leavesInPlace,
  publishProblems,
  savePayload,
  withAsset,
  type Draft,
  type DraftFields,
  type StoredArticle,
} from './article-draft'
import { AREA, FIELD, SELECT } from '@/components/admin-ui/controls'
import { MAX_UPLOAD_BYTES } from '@/lib/recipes/upload-limits'

/**
 * The Alpha Tech Blogs editor.
 *
 * Deliberately not gated by the route that renders it. Every write goes
 * through `/api/admin/articles`, which calls `requireAdmin()` for itself; this
 * component asks `/api/admin/session` who it is and renders accordingly, which
 * is a convenience for the editor and never the check. The same reasoning the
 * product admin's header sets out: a page is not an authorisation boundary.
 *
 * Two behaviours are worth naming because they are decisions rather than
 * defaults:
 *
 * - **Draft and published are the same screen.** Publishing is a button, not a
 *   different editor. The spec problems are visible the whole time, so the
 *   editor knows what publishing will refuse before they press it rather than
 *   after — which is the difference between a checklist and an error dialog.
 * - **Nothing autosaves.** An article is prose, and an autosave that publishes
 *   a half-rewritten sentence to a live URL is worse than losing a paragraph.
 *   `dirty` drives the leave warnings instead.
 *
 * What lands on the draft, and when, is `article-draft.ts` — pure, so the
 * rules can run in a test with no DOM.
 */

const KINDS: readonly ArticleKind[] = ['article', 'knowledge']

/** Where a saved page lives. One definition for the path hint and the link. */
const pathFor = (kind: ArticleKind, id: string) =>
  kind === 'knowledge' ? `/learn/${id}` : `/blog/${id}`

type ListResult = { ok: true; rows: ArticleRecord[] } | { ok: false; error: string }

export function ArticleAdmin() {
  const t = useTranslations('labAdmin')
  /* One probe for the whole department, run by `<AdminShell>` above. This
     component renders only once the gate has opened, so it may assume an
     admin from its first line — the "checking", "not an editor" and "cannot
     verify" screens are the shell's now, not three more branches here. */
  const { authed, bearer } = useAdminSession()

  const [articles, setArticles] = useState<ArticleRecord[]>([])
  /* Whether the list has loaded at all, and why it last failed. "No articles
     yet" is an answer, so it is shown only after one: during an outage the
     aside used to say the blog was empty. */
  const [listLoaded, setListLoaded] = useState(false)
  const [listError, setListError] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [busy, setBusy] = useState<'' | 'loading' | 'saving' | 'deleting'>('')
  const [status, setStatus] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null)
  /* Asset id → short-lived signed URL. Editor-only state: the URLs expire in
     ten minutes and none of them is ever written into a block, which stores an
     asset UUID and nothing else. Refetched with the article, including after a
     save, so publishing a draft does not leave the editor looking at a preview
     that no longer describes where the picture lives. */
  const [previews, setPreviews] = useState<Readonly<Record<string, string>>>({})
  const [query, setQuery] = useState('')
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

  /* Fetches and sets no state, so each caller can decide whether the answer
     still has anywhere to go. */
  const fetchList = useCallback(async (): Promise<ListResult> => {
    try {
      const res = await fetch('/api/admin/articles', { headers: authed() })
      const data = (await res.json()) as { articles?: ArticleRecord[]; error?: string }
      if (!res.ok || !data.articles) return { ok: false, error: data.error ?? 'loadFailed' }
      return { ok: true, rows: data.articles }
    } catch {
      return { ok: false, error: 'loadFailed' }
    }
  }, [authed])

  const applyList = useCallback((result: ListResult) => {
    if (result.ok) {
      setArticles(result.rows)
      setListLoaded(true)
      setListError(null)
    } else {
      setListError(result.error)
    }
  }, [])

  /** Refresh after a save or a delete, where the component is certainly alive. */
  const loadList = useCallback(async () => applyList(await fetchList()), [applyList, fetchList])

  /* No session probe of its own any more — mounting IS the answer, because
     `<AdminShell>` renders this only when the gate opened. The `live` flag
     outlives the await: a list that arrives after the editor unmounts has
     nothing left to set. */
  useEffect(() => {
    let live = true
    ;(async () => {
      const result = await fetchList()
      if (live) applyList(result)
    })()
    return () => {
      live = false
    }
  }, [fetchList, applyList])

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
   * `openArticle` does, from the click that knows the current answer. A save
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
    } catch {
      /* A network failure, or a platform error page that is not JSON. */
      if (opening.current === id) setStatus({ kind: 'err', msg: codeMessage('loadFailed') })
    } finally {
      if (opening.current === id) setBusy('')
    }
  }

  function openArticle(id: string) {
    if (dirty && !window.confirm(t('discardConfirm'))) return
    void loadArticle(id)
  }

  function startNew() {
    if (dirty && !window.confirm(t('discardConfirm'))) return
    opening.current = null
    setDraft(blankDraft())
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
    if (!draft) return
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
        return
      }

      await loadList()
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
    } catch {
      setStatus({ kind: 'err', msg: codeMessage('saveFailed') })
    } finally {
      setBusy('')
    }
  }

  async function remove() {
    if (!draft?.id) return
    if (!window.confirm(t('deleteConfirm', { title: draft.title }))) return
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
        return
      }
      opening.current = null
      setDraft(null)
      setStatus({ kind: 'ok', msg: t('deleted') })
      await loadList()
    } catch {
      /* No readable answer, so no telling whether the row went. The list is
         re-read so it shows whichever is true. */
      setStatus({ kind: 'err', msg: codeMessage('deleteFailed') })
      await loadList()
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

  const addBlock = (type: Block['t']) => setDraft((d) => (d ? withNewBlock(d, type) : d))

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

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return articles
    return articles.filter(
      (a) => a.title.toLowerCase().includes(q) || a.id.toLowerCase().includes(q),
    )
  }, [articles, query])

  return (
    <main className="mx-auto flex w-full max-w-[110rem] flex-wrap items-start gap-y-8 gap-x-[clamp(2rem,3vw,3.5rem)] inset-safe pb-24 pt-8">
      {/* ---- the list ----
          Held still while a request is out: opening another article mid-save
          used to have the save's answer land on it. */}
      <aside className="flex grow basis-[clamp(16rem,20vw,22rem)] flex-col gap-4 self-start lg:sticky lg:top-6 lg:grow-0">
        <button
          type="button"
          onClick={startNew}
          disabled={busy !== ''}
          className="btn-accent w-full cursor-pointer disabled:opacity-40"
        >
          {t('newArticle')}
        </button>

        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className={FIELD}
        />

        <ul className="scroll-area max-h-[60vh] overflow-y-auto">
          {visible.map((a) => {
            const on = draft?.id === a.id
            return (
              <li key={a.id}>
                <hr className="seam" />
                <button
                  type="button"
                  onClick={() => openArticle(a.id)}
                  disabled={busy !== ''}
                  className={
                    'flex w-full min-h-[var(--layout-touch-target)] cursor-pointer flex-col gap-1 rounded-md px-3 py-3 text-left transition-colors disabled:cursor-wait ' +
                    (on ? 'surface-selected' : 'hover:bg-glass')
                  }
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <span
                      className={
                        'chip font-semibold uppercase tracking-[0.08em] ' +
                        (a.status === 'published'
                          ? 'bg-accent-500 text-white'
                          : 'bg-glass-raised text-ink-muted')
                      }
                    >
                      {a.status === 'published' ? t('statusPublished') : t('statusDraft')}
                    </span>
                    <span className="meta">{t('blockCount', { n: a.blocks.length })}</span>
                  </span>
                  {/* `text-ink` on the selected row too: the admin is the paper
                      room, where `.surface-selected` is a pale tint and white
                      text on it disappeared (CLAUDE.md rule 3). */}
                  <span className="text-body-sm font-semibold leading-[1.35] text-ink">
                    {a.title}
                  </span>
                </button>
              </li>
            )
          })}
          {listError ? (
            <li className="py-6">
              <p className="meta text-danger">{codeMessage(listError)}</p>
            </li>
          ) : listLoaded && visible.length === 0 ? (
            <li className="py-6">
              <p className="meta">{t('listEmpty')}</p>
            </li>
          ) : null}
        </ul>
      </aside>

      {/* ---- the editor ---- */}
      <div className="flex min-w-0 flex-1 basis-[34rem] flex-col gap-5">
        {/* Outside the draft branch: a delete clears the draft before it
            reports, and a failed open has no draft to report beside. */}
        {status ? (
          <p
            role="status"
            className={`text-body-sm ${status.kind === 'ok' ? 'text-accent-400' : 'text-danger'}`}
          >
            {status.msg}
          </p>
        ) : null}

        {!draft ? (
          <div className="surface px-6 py-14">
            <h1 className="text-title-2 font-extrabold tracking-[-0.02em] text-ink">
              {t('pickTitle')}
            </h1>
            <p className="mt-3 max-w-[56ch] text-body text-ink-muted">{t('pickBody')}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {/* --- action bar --- */}
            <div className="surface-raised flex flex-wrap items-center gap-3 px-5 py-4">
              <button
                type="button"
                /* Keeps the article's status: on a live article this saves the
                   edit and leaves it live. Publishing and unpublishing are the
                   other button's job alone. */
                onClick={() => void save(draft.status)}
                disabled={busy !== '' || !draft.title.trim()}
                className="btn-glass cursor-pointer disabled:opacity-40"
              >
                {busy === 'saving'
                  ? t('saving')
                  : draft.status === 'published'
                    ? t('saveChanges')
                    : t('saveDraft')}
              </button>

              {draft.id ? (
                <button
                  type="button"
                  onClick={() => void save(draft.status === 'published' ? 'draft' : 'published')}
                  /* A blank title is refused by the route either way; disabled
                     here as Save is, rather than answered with an error. */
                  disabled={busy !== '' || !draft.title.trim()}
                  className="btn-accent cursor-pointer disabled:opacity-40"
                >
                  {draft.status === 'published' ? t('unpublish') : t('publish')}
                </button>
              ) : null}

              {draft.id && draft.status === 'published' ? (
                <Link href={pathFor(draft.kind, draft.id)} className="chip chip-action">
                  {t('viewLive')}
                </Link>
              ) : null}

              <span className="flex-1" />

              {draft.id ? (
                <button
                  type="button"
                  onClick={() => void remove()}
                  disabled={busy !== ''}
                  className="chip chip-action text-danger disabled:opacity-40"
                >
                  {busy === 'deleting' ? t('deleting') : t('delete')}
                </button>
              ) : null}
            </div>

            {/* --- the spec checklist ---
                Shown always, not only on a failed publish. These are the rules
                publishing will apply, so an editor should be able to watch
                them clear while they write rather than meet them as a wall. */}
            <div className="surface px-5 py-4">
              <p className="label text-accent-400">
                {problems.length === 0 ? t('specClear') : t('specRemaining', { n: problems.length })}
              </p>
              {problems.length > 0 ? (
                <ul className="mt-2 flex flex-col gap-1">
                  {problems.map((code) => (
                    <li key={code} className="flex gap-2">
                      <span aria-hidden className="text-ink-faint">
                        —
                      </span>
                      <span className="text-body-sm text-ink-muted">
                        {codeMessage(code)}
                        {code === 'relatedUnknown' && unknownRefs.length > 0 ? (
                          <>
                            {' '}
                            {t('unknownRefs')}{' '}
                            <span className="font-semibold text-ink">
                              {unknownRefs.map((r) => r.id).join(', ')}
                            </span>
                          </>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            {/* --- metadata --- */}
            <div className="surface flex flex-col gap-4 px-5 py-5">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="art-title" className="label">
                  {t('title')}
                </label>
                <input
                  id="art-title"
                  type="text"
                  value={draft.title}
                  onChange={(e) => edit({ title: e.target.value })}
                  className={FIELD}
                />
                {draft.id ? <p className="meta">{pathFor(draft.kind, draft.id)}</p> : <p className="meta">{t('slugOnCreate')}</p>}
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <label htmlFor="art-dek" className="label">
                    {t('dek')}
                  </label>
                  <span className={`meta ${draft.dek.length > 220 ? 'text-danger' : ''}`}>
                    {draft.dek.length}/220
                  </span>
                </div>
                <textarea
                  id="art-dek"
                  value={draft.dek}
                  onChange={(e) => edit({ dek: e.target.value })}
                  rows={2}
                  className={AREA}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="art-kind" className="label">
                    {t('kind')}
                  </label>
                  {/* Locked while published: the kind is the URL prefix, and
                      the route refuses the change anyway (409). */}
                  <select
                    id="art-kind"
                    value={draft.kind}
                    onChange={(e) => edit({ kind: e.target.value as ArticleKind })}
                    disabled={draft.status === 'published'}
                    title={draft.status === 'published' ? t('kindLockedHint') : undefined}
                    className={`${SELECT} disabled:opacity-60`}
                  >
                    {KINDS.map((k) => (
                      <option key={k} value={k}>
                        {t(`kinds.${k}` as never)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="art-topic" className="label">
                    {t('topic')}
                  </label>
                  <select
                    id="art-topic"
                    value={draft.topic}
                    onChange={(e) => edit({ topic: e.target.value as Draft['topic'] })}
                    className={SELECT}
                  >
                    {TOPICS.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="art-level" className="label">
                    {t('level')}
                  </label>
                  <select
                    id="art-level"
                    value={draft.level}
                    onChange={(e) => edit({ level: e.target.value as Draft['level'] })}
                    className={SELECT}
                  >
                    {LEVELS.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="art-archetype" className="label">
                    {t('archetype')}
                  </label>
                  <select
                    id="art-archetype"
                    value={draft.archetype}
                    onChange={(e) => edit({ archetype: e.target.value as Archetype })}
                    className={SELECT}
                  >
                    {ARCHETYPES.map((a) => (
                      <option key={a} value={a}>
                        {t(`archetypes.${a}` as never)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="art-read" className="label">
                    {t('readTime')}
                  </label>
                  <input
                    id="art-read"
                    type="text"
                    value={draft.read}
                    onChange={(e) => edit({ read: e.target.value })}
                    placeholder={t('readTimePlaceholder')}
                    className={FIELD}
                  />
                </div>
              </div>
            </div>

            <MetaEditor
              kind={draft.kind}
              meta={draft.meta}
              onChange={(meta) => edit({ meta })}
              refs={refs}
              refsFailed={refsFailed}
              unknownRefs={unknownRefs}
            />

            {/* --- blocks --- */}
            {draft.blocks.map(({ key, block }, i) => (
              <section key={key} className="surface flex flex-col gap-4 px-5 py-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="chip bg-accent-900 font-semibold uppercase tracking-[0.08em] text-ink">
                    {t(`blocks.${block.t}` as never)}
                  </span>
                  <span className="meta tabular-nums">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="flex-1" />
                  <button
                    type="button"
                    onClick={() => moveBlock(key, -1)}
                    disabled={i === 0}
                    className="chip chip-action disabled:opacity-30"
                    aria-label={t('moveUp')}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveBlock(key, 1)}
                    disabled={i === draft.blocks.length - 1}
                    className="chip chip-action disabled:opacity-30"
                    aria-label={t('moveDown')}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => removeBlock(key)}
                    className="chip chip-action text-danger"
                  >
                    {t('removeBlock')}
                  </button>
                </div>

                <BlockFields
                  block={block}
                  onChange={(next) => setBlock(key, next)}
                  onAsset={(field, assetId) => setAsset(draft.session, key, field, assetId)}
                  upload={upload}
                  previews={previews}
                  canUpload={articleId !== null}
                />
              </section>
            ))}

            {/* --- add a block --- */}
            <div className="surface-raised flex flex-col gap-3 px-5 py-4">
              <p className="label">{t('addBlock')}</p>
              <ul className="flex flex-wrap gap-2">
                {BLOCK_TYPES.map((type) => (
                  <li key={type}>
                    <button
                      type="button"
                      onClick={() => addBlock(type)}
                      className="chip chip-action"
                    >
                      {t(`blocks.${type}` as never)}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

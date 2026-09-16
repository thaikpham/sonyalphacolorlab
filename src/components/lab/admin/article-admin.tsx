'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { useAdminSession } from '@/components/admin-ui/session'
import { LEVELS, TOPICS } from '@/lib/lab/articles'
import type { Archetype, Article, ArticleRecord, ArticleStatus, Block } from '@/lib/lab/types'
import { BLOCK_TYPES, BlockFields, emptyBlock, type UploadFn } from './block-editor'
import { AREA, FIELD, SELECT } from '@/components/admin-ui/controls'

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
 *   `dirty` drives the leave warning instead.
 */

const ARCHETYPES: readonly Archetype[] = [
  'setup-guide',
  'versus',
  'technique',
  'explainer',
  'fix',
  'gear',
  'recipe',
]

type Draft = {
  id: string | null
  status: ArticleStatus
  topic: Article['topic']
  level: Article['level']
  archetype: Archetype
  read: string
  title: string
  dek: string
  blocks: Block[]
}

const asDraft = (a: ArticleRecord): Draft => ({
  id: a.id,
  status: a.status,
  topic: a.topic,
  level: a.level,
  archetype: a.archetype,
  read: a.read,
  title: a.title,
  dek: a.dek,
  blocks: [...a.blocks],
})

const blankDraft = (): Draft => ({
  id: null,
  status: 'draft',
  topic: 'setup',
  level: 'newbie',
  archetype: 'explainer',
  read: '',
  title: '',
  dek: '',
  blocks: [],
})

export function ArticleAdmin() {
  const t = useTranslations('labAdmin')
  /* One probe for the whole department, run by `<AdminShell>` above. This
     component renders only once the gate has opened, so it may assume an
     admin from its first line — the "checking", "not an editor" and "cannot
     verify" screens are the shell's now, not three more branches here. */
  const { authed, bearer } = useAdminSession()

  const [articles, setArticles] = useState<ArticleRecord[]>([])
  const [draft, setDraft] = useState<Draft | null>(null)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState<'' | 'loading' | 'saving' | 'deleting'>('')
  const [status, setStatus] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null)
  const [problems, setProblems] = useState<readonly string[]>([])
  /* Asset id → short-lived signed URL. Editor-only state: the URLs expire in
     ten minutes and none of them is ever written into a block, which stores an
     asset UUID and nothing else. Refetched with the article, including after a
     save, so publishing a draft does not leave the editor looking at a preview
     that no longer describes where the picture lives. */
  const [previews, setPreviews] = useState<Readonly<Record<string, string>>>({})
  const [query, setQuery] = useState('')

  /* An error code, never a sentence from the server. The routes answer with
     codes for the same reason the community ones do: a literal renders
     untranslated in the other locale and is invisible to the parity test. */
  const codeMessage = useCallback(
    (code: string) => (t.has(`errors.${code}` as never) ? t(`errors.${code}` as never) : code),
    [t],
  )

  /* Fetches and reports failure, but sets no list state — so the mount effect
     below can decide for itself whether the answer still has anywhere to go. */
  const fetchList = useCallback(async (): Promise<ArticleRecord[] | null> => {
    try {
      const res = await fetch('/api/admin/articles', { headers: authed() })
      const data = (await res.json()) as { articles?: ArticleRecord[]; error?: string }
      if (!res.ok || !data.articles) {
        setStatus({ kind: 'err', msg: codeMessage(data.error ?? 'loadFailed') })
        return null
      }
      return data.articles
    } catch {
      setStatus({ kind: 'err', msg: codeMessage('loadFailed') })
      return null
    }
  }, [authed, codeMessage])

  /** Refresh after a save or a delete, where the component is certainly alive. */
  const loadList = useCallback(async () => {
    const rows = await fetchList()
    if (rows) setArticles(rows)
  }, [fetchList])

  /* No session probe of its own any more — mounting IS the answer, because
     `<AdminShell>` renders this only when the gate opened. The `live` flag
     outlives the await: a list that arrives after the editor unmounts has
     nothing left to set. */
  useEffect(() => {
    let live = true
    ;(async () => {
      const rows = await fetchList()
      if (live && rows) setArticles(rows)
    })()
    return () => {
      live = false
    }
  }, [fetchList])

  /* The one guard against losing a draft. Nothing autosaves, so the browser's
     own prompt is what stands between an unsaved rewrite and a closed tab. */
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const edit = useCallback((patch: Partial<Draft>) => {
    setDraft((d) => (d ? { ...d, ...patch } : d))
    setDirty(true)
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
   * Separate from `openArticle` because it runs after a save, where reloading
   * the whole record would throw away the editor's unsaved scroll position and
   * any block they were mid-edit on. Only the previews are stale.
   */
  async function refreshPreviews(id: string) {
    try {
      const res = await fetch(`/api/admin/articles/${id}`, { headers: authed() })
      if (!res.ok) return
      const data = (await res.json()) as { previews?: Record<string, string> }
      setPreviews(data.previews ?? {})
    } catch {
      /* A stale preview is a cosmetic problem and the save already succeeded.
         Reporting a failure here would tell the editor their article did not
         save, which would be false. */
    }
  }

  async function openArticle(id: string) {
    if (dirty && !window.confirm(t('discardConfirm'))) return
    setBusy('loading')
    setStatus(null)
    try {
      const res = await fetch(`/api/admin/articles/${id}`, { headers: authed() })
      const data = (await res.json()) as {
        article?: ArticleRecord
        problems?: string[]
        previews?: Record<string, string>
        error?: string
      }
      if (!res.ok || !data.article) {
        setStatus({ kind: 'err', msg: codeMessage(data.error ?? 'loadFailed') })
        return
      }
      setDraft(asDraft(data.article))
      setProblems(data.problems ?? [])
      setPreviews(data.previews ?? {})
      setDirty(false)
    } finally {
      setBusy('')
    }
  }

  function startNew() {
    if (dirty && !window.confirm(t('discardConfirm'))) return
    setDraft(blankDraft())
    setPreviews({})
    setProblems([])
    setStatus(null)
    setDirty(false)
  }

  /**
   * Save, and optionally publish.
   *
   * The two are one request because they are one row. `nextStatus` is what the
   * article becomes; the route refuses `published` when the spec problems are
   * non-empty and returns the list, which is why a failed publish still leaves
   * the editor holding an accurate problem list rather than a stale one.
   */
  async function save(nextStatus: ArticleStatus) {
    if (!draft) return
    setBusy('saving')
    setStatus(null)

    const body = JSON.stringify({
      topic: draft.topic,
      level: draft.level,
      archetype: draft.archetype,
      read: draft.read,
      title: draft.title,
      dek: draft.dek,
      blocks: draft.blocks,
      status: nextStatus,
    })

    try {
      const creating = draft.id === null
      const res = await fetch(
        creating ? '/api/admin/articles' : `/api/admin/articles/${draft.id}`,
        { method: creating ? 'POST' : 'PATCH', headers: authed(), body },
      )
      const data = (await res.json()) as {
        ok?: boolean
        id?: string
        problems?: string[]
        dropped?: number
        error?: string
      }

      if (data.problems) setProblems(data.problems)

      if (!res.ok) {
        setStatus({ kind: 'err', msg: codeMessage(data.error ?? 'saveFailed') })
        return
      }

      const savedId = data.id ?? draft.id
      setDraft({ ...draft, id: savedId, status: creating ? 'draft' : nextStatus })
      setDirty(false)
      await loadList()

      if (savedId) {
        if (data.dropped) {
          /* The parser refused a block, so the row no longer matches what is on
             screen — and `dirty` is false, so nothing would prompt the editor
             to reconcile them. Left alone they would keep editing blocks that
             are already gone, and the next save would drop them again. Reload
             the record: it is the only state that is true. */
          await openArticle(savedId)
        } else {
          /* Read the previews back rather than trusting the draft in hand.
             Publishing moves an asset's bytes between buckets, so a signed URL
             taken before the save may point at the wrong copy. */
          await refreshPreviews(savedId)
        }
      }

      setStatus({
        kind: 'ok',
        /* The dropped count is surfaced, not swallowed. A block the parser
           refused is gone from the row the moment this returns, and an editor
           who is not told will find out by scrolling past a gap next week. */
        msg: data.dropped
          ? t('savedWithDropped', { n: data.dropped })
          : creating
            ? t('created')
            : nextStatus === 'published'
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
      setDraft(null)
      setDirty(false)
      setProblems([])
      setStatus({ kind: 'ok', msg: t('deleted') })
      await loadList()
    } finally {
      setBusy('')
    }
  }

  // --- block list operations, all immutable ------------------------------

  const setBlock = (i: number, next: Block) =>
    edit({ blocks: draft ? draft.blocks.map((b, bi) => (bi === i ? next : b)) : [] })

  const addBlock = (type: Block['t']) =>
    edit({ blocks: draft ? [...draft.blocks, emptyBlock(type)] : [] })

  const removeBlock = (i: number) =>
    edit({ blocks: draft ? draft.blocks.filter((_, bi) => bi !== i) : [] })

  /** Move by swapping with the neighbour — the only reorder an article needs,
      and the one that works with a keyboard without a drag surface. */
  const moveBlock = (i: number, by: -1 | 1) => {
    if (!draft) return
    const target = i + by
    if (target < 0 || target >= draft.blocks.length) return
    const blocks = [...draft.blocks]
    ;[blocks[i], blocks[target]] = [blocks[target], blocks[i]]
    edit({ blocks })
  }

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return articles
    return articles.filter(
      (a) => a.title.toLowerCase().includes(q) || a.id.toLowerCase().includes(q),
    )
  }, [articles, query])

  return (
    <main className="mx-auto flex w-full max-w-[110rem] flex-wrap items-start gap-y-8 gap-x-[clamp(2rem,3vw,3.5rem)] inset-safe pb-24 pt-8">
      {/* ---- the list ---- */}
      <aside className="flex grow basis-[clamp(16rem,20vw,22rem)] flex-col gap-4 self-start lg:sticky lg:top-6 lg:grow-0">
        <button type="button" onClick={startNew} className="btn-accent w-full cursor-pointer">
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
                  onClick={() => void openArticle(a.id)}
                  className={
                    'flex w-full min-h-[var(--layout-touch-target)] cursor-pointer flex-col gap-1 rounded-md px-3 py-3 text-left transition-colors ' +
                    (on ? 'surface-selected' : 'hover:bg-glass')
                  }
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <span
                      className={
                        'chip font-semibold uppercase tracking-[0.08em] ' +
                        (a.status === 'published'
                          ? 'bg-accent-500 text-white'
                          : 'bg-white/[0.08] text-ink-muted')
                      }
                    >
                      {a.status === 'published' ? t('statusPublished') : t('statusDraft')}
                    </span>
                    <span className="meta">{a.blocks.length}</span>
                  </span>
                  <span
                    className={
                      'text-body-sm font-semibold leading-[1.35] ' +
                      (on ? 'text-white' : 'text-ink')
                    }
                  >
                    {a.title}
                  </span>
                </button>
              </li>
            )
          })}
          {visible.length === 0 ? (
            <li className="py-6">
              <p className="meta">{t('listEmpty')}</p>
            </li>
          ) : null}
        </ul>
      </aside>

      {/* ---- the editor ---- */}
      <div className="min-w-0 flex-1 basis-[34rem]">
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
                onClick={() => void save('draft')}
                disabled={busy !== '' || !draft.title.trim()}
                className="btn-glass cursor-pointer disabled:opacity-40"
              >
                {busy === 'saving' ? t('saving') : t('saveDraft')}
              </button>

              {draft.id ? (
                <button
                  type="button"
                  onClick={() => void save(draft.status === 'published' ? 'draft' : 'published')}
                  disabled={busy !== ''}
                  className="btn-accent cursor-pointer disabled:opacity-40"
                >
                  {draft.status === 'published' ? t('unpublish') : t('publish')}
                </button>
              ) : null}

              {draft.id && draft.status === 'published' ? (
                <Link href={`/blog/${draft.id}`} className="chip chip-action">
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

            {status ? (
              <p
                role="status"
                className={`text-body-sm ${status.kind === 'ok' ? 'text-accent-400' : 'text-danger'}`}
              >
                {status.msg}
              </p>
            ) : null}

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
                      <span className="text-body-sm text-ink-muted">{codeMessage(code)}</span>
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
                {draft.id ? <p className="meta">/blog/{draft.id}</p> : <p className="meta">{t('slugOnCreate')}</p>}
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

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
                    placeholder="6 phút đọc"
                    className={FIELD}
                  />
                </div>
              </div>
            </div>

            {/* --- blocks --- */}
            {draft.blocks.map((block, i) => (
              <section key={i} className="surface flex flex-col gap-4 px-5 py-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="chip bg-accent-900 font-semibold uppercase tracking-[0.08em] text-white">
                    {t(`blocks.${block.t}` as never)}
                  </span>
                  <span className="meta tabular-nums">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="flex-1" />
                  <button
                    type="button"
                    onClick={() => moveBlock(i, -1)}
                    disabled={i === 0}
                    className="chip chip-action disabled:opacity-30"
                    aria-label={t('moveUp')}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveBlock(i, 1)}
                    disabled={i === draft.blocks.length - 1}
                    className="chip chip-action disabled:opacity-30"
                    aria-label={t('moveDown')}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => removeBlock(i)}
                    className="chip chip-action text-danger"
                  >
                    {t('removeBlock')}
                  </button>
                </div>

                <BlockFields
                  block={block}
                  onChange={(next) => setBlock(i, next)}
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

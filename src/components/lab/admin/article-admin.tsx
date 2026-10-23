'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { useAdminSession } from '@/components/admin-ui/session'
import { LEVELS, TOPICS } from '@/lib/lab/articles'
import { ARCHETYPES } from '@/lib/lab/parse'
import type { Archetype, ArticleKind, ArticleRecord, Block } from '@/lib/lab/types'
import { BLOCK_TYPES, BlockFields } from './block-editor'
import { MetaEditor } from './meta-editor'
import { useArticleEditor } from './use-article-editor'
import { AREA, FIELD, SELECT } from '@/components/admin-ui/controls'
import type { Draft } from './article-draft'

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
  const { authed } = useAdminSession()

  const [articles, setArticles] = useState<ArticleRecord[]>([])
  /* Whether the list has loaded at all, and why it last failed. "No articles
     yet" is an answer, so it is shown only after one: during an outage the
     aside used to say the blog was empty. */
  const [listLoaded, setListLoaded] = useState(false)
  const [listError, setListError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  const editor = useArticleEditor({
    onStored: () => void loadList(),
    onRemoved: () => void loadList(),
  })
  const {
    draft,
    dirty,
    busy,
    status,
    previews,
    refs,
    refsFailed,
    unknownRefs,
    problems,
    codeMessage,
    edit,
    loadArticle,
    save,
    remove,
    upload,
    setBlock,
    setAsset,
    removeBlock,
    moveBlock,
  } = editor

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

  function openArticle(id: string) {
    if (dirty && !window.confirm(t('discardConfirm'))) return
    void loadArticle(id)
  }

  function startNew() {
    if (dirty && !window.confirm(t('discardConfirm'))) return
    editor.startNew()
  }

  const addBlock = (type: Block['t']) => editor.insertBlock(type, draft?.blocks.length ?? 0)

  async function removeArticle() {
    if (!draft?.id || !window.confirm(t('deleteConfirm', { title: draft.title }))) return
    await remove()
  }

  const articleId = draft?.id ?? null

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
                  onClick={() => void removeArticle()}
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

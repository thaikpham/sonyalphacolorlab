'use client'

import { useFormatter, useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { FIELD, SELECT } from '@/components/admin-ui/controls'
import { LEVELS, TOPICS } from '@/lib/lab/articles'
import { ARCHETYPES } from '@/lib/lab/parse'
import type { Archetype, ArticleKind } from '@/lib/lab/types'
import type { Draft } from '../admin/article-draft'
import type { ArticleEditor } from '../admin/use-article-editor'

/** Where a saved page lives. */
export const pathFor = (kind: ArticleKind, id: string) =>
  kind === 'knowledge' ? `/learn/${id}` : `/blog/${id}`

const KINDS: readonly ArticleKind[] = ['article', 'knowledge']

/** The status, the save line, the publish rules and the classification. */
export function EditorRail({ editor, onDeleted }: { editor: ArticleEditor; onDeleted: () => void }) {
  const t = useTranslations('labAdmin')
  const format = useFormatter()
  const { draft, busy, status, savedAt, dirty } = editor
  if (!draft) return null

  const line =
    busy === 'saving'
      ? t('saving')
      : status?.kind === 'err'
        ? status.msg
        : status?.kind === 'ok'
          ? status.msg
          : dirty
            ? t('unsaved')
            : savedAt
              ? t('savedAt', {
                  time: format.dateTime(savedAt, {
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                  }),
                })
              : null

  return (
    <aside className="flex grow basis-[clamp(15rem,19vw,20rem)] flex-col gap-4 self-end lg:sticky lg:top-6 lg:grow-0">
      <div className="surface flex flex-col gap-3 px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className={'chip font-semibold uppercase tracking-[0.08em] ' + (draft.status === 'published' ? 'bg-accent-500 text-white' : 'bg-glass-raised text-ink-muted')}>
            {draft.status === 'published' ? t('statusPublished') : t('statusDraft')}
          </span>
          <p role="status" aria-live="polite" className={'meta ' + (status?.kind === 'err' ? 'text-danger' : '')}>
            {line}
          </p>
        </div>
        <EditorActions editor={editor} className="hidden lg:flex" onDeleted={onDeleted} />
      </div>

      <div className="surface px-5 py-4">
        <p className="label text-accent-400">
          {editor.problems.length === 0 ? t('specClear') : t('specRemaining', { n: editor.problems.length })}
        </p>
        {editor.problems.length > 0 ? (
          <ul className="mt-2 flex flex-col gap-1">
            {editor.problems.map((code) => (
              <li key={code} className="text-body-sm text-ink-muted">
                {editor.codeMessage(code)}
                {code === 'relatedUnknown' && editor.unknownRefs.length > 0 ? (
                  <> {t('unknownRefs')} <span className="font-semibold text-ink">{editor.unknownRefs.map((r) => r.id).join(', ')}</span></>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <Classification draft={draft} edit={editor.edit} />
    </aside>
  )
}

function Classification({ draft, edit }: { draft: Draft; edit: ArticleEditor['edit'] }) {
  const t = useTranslations('labAdmin')
  return (
    <div className="surface flex flex-col gap-3 px-5 py-4">
      <label className="flex flex-col gap-1.5">
        <span className="label">{t('kind')}</span>
        <select value={draft.kind} onChange={(e) => edit({ kind: e.target.value as ArticleKind })} disabled={draft.status === 'published'} title={draft.status === 'published' ? t('kindLockedHint') : undefined} className={`${SELECT} disabled:opacity-60`}>
          {KINDS.map((k) => <option key={k} value={k}>{t(`kinds.${k}` as never)}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="label">{t('topic')}</span>
        <select value={draft.topic} onChange={(e) => edit({ topic: e.target.value as Draft['topic'] })} className={SELECT}>
          {TOPICS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="label">{t('level')}</span>
        <select value={draft.level} onChange={(e) => edit({ level: e.target.value as Draft['level'] })} className={SELECT}>
          {LEVELS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="label">{t('archetype')}</span>
        <select value={draft.archetype} onChange={(e) => edit({ archetype: e.target.value as Archetype })} className={SELECT}>
          {ARCHETYPES.map((a) => <option key={a} value={a}>{t(`archetypes.${a}` as never)}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="label">{t('readTime')}</span>
        <input type="text" value={draft.read} onChange={(e) => edit({ read: e.target.value })} placeholder={t('readTimePlaceholder')} className={FIELD} />
      </label>
    </div>
  )
}

/** Lưu, Đăng / Đưa về bản nháp, Xem trang, Xoá. */
export function EditorActions({
  editor,
  className = 'flex',
  onDeleted,
}: {
  editor: ArticleEditor
  className?: string
  onDeleted?: () => void
}) {
  const t = useTranslations('labAdmin')
  const { draft, busy } = editor
  if (!draft) return null
  return (
    /* `display` comes from the caller alone: `flex` beside `hidden` on one
       element is decided by stylesheet order, not by intent. */
    <div className={`flex-wrap items-center gap-2 ${className}`}>
      <button type="button" onClick={() => void editor.save(draft.status)} disabled={busy !== '' || !draft.title.trim()} className="btn-glass cursor-pointer disabled:opacity-40">
        {busy === 'saving' ? t('saving') : draft.status === 'published' ? t('saveChanges') : t('saveDraft')}
      </button>
      {draft.id ? (
        <button type="button" onClick={() => void editor.save(draft.status === 'published' ? 'draft' : 'published')} disabled={busy !== '' || !draft.title.trim()} className="btn-accent cursor-pointer disabled:opacity-40">
          {draft.status === 'published' ? t('unpublish') : t('publish')}
        </button>
      ) : null}
      {draft.id && draft.status === 'published' ? (
        <Link href={pathFor(draft.kind, draft.id)} className="chip chip-action">{t('viewLive')}</Link>
      ) : null}
      {draft.id && onDeleted ? (
        <button
          type="button"
          onClick={async () => {
            if (!window.confirm(t('deleteConfirm', { title: draft.title }))) return
            if (await editor.remove()) onDeleted()
          }}
          disabled={busy !== ''}
          className="chip chip-action text-danger disabled:opacity-40"
        >
          {busy === 'deleting' ? t('deleting') : t('delete')}
        </button>
      ) : null}
    </div>
  )
}

/** The actions on the bottom edge, below `lg`. A sibling of the page, never inside a moving one. */
export function EditorBottomBar({ editor, onDeleted }: { editor: ArticleEditor; onDeleted: () => void }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 pb-safe lg:hidden">
      <div className="surface-raised mx-3 mb-3 px-4 py-3">
        <EditorActions editor={editor} onDeleted={onDeleted} />
      </div>
    </div>
  )
}

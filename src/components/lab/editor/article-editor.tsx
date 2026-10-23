'use client'

import { useEffect, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { getPathname, useRouter } from '@/i18n/navigation'
import { ARTICLE_LANG } from '@/lib/lab/articles'
import type { ArticleKind } from '@/lib/lab/types'
import { MetaEditor } from '../admin/meta-editor'
import { useArticleEditor } from '../admin/use-article-editor'
import { BlockInserter } from './block-inserter'
import { EditableBlock } from './editable-block'
import { EditorBottomBar, EditorRail, pathFor } from './editor-rail'

/**
 * The page, as its own editor (spec: docs/superpowers/specs/2026-10-22-edit-in-place-design.md).
 * The same column and rail as `ArticleView`; the blocks are the reader's until
 * one is opened. Nothing autosaves.
 */
export function ArticleEditor({ id, kind }: { id: string | null; kind: ArticleKind }) {
  const t = useTranslations('labAdmin')
  const locale = useLocale()
  const router = useRouter()
  /* The kind the URL currently names. Starts at the route's prop, but the
     prop is fixed at mount and this instance no longer remounts on a
     kind-changing save — comparing against `kind` itself would take the
     `replaceState` branch forever after the first move, and `router.refresh()`
     would never fire again. */
  const urlKind = useRef(kind)
  /* Whether the URL has been moved in place. Next keeps the route tree it
     mounted (`blog/new`, or the other kind's `[id]/edit`), so a later
     refresh asks the server for a tree that no longer matches and
     remounts the whole gate: the session probed again, the article read
     again, the save line blank and the open block shut (seen on
     /vi/blog/new → Lưu nháp → edit → Lưu nháp, 2026-10-23). Once moved,
     there is nothing on this route for a refresh to bring back. */
  const moved = useRef(false)
  const editor = useArticleEditor({
    onStored: (stored, created) => {
      if (created || stored.kind !== urlKind.current) {
        /* `router.replace` would remount the route, dropping whatever was
           typed during the round trip (which `afterSave` keeps, dirty) and
           losing the "created"/"saved at" line on the fresh instance. The
           URL alone moves; this instance and its draft stay. */
        window.history.replaceState(null, '', getPathname({ href: `${pathFor(stored.kind, stored.id)}/edit`, locale }))
        urlKind.current = stored.kind
        moved.current = true
      } else if (!moved.current) {
        router.refresh()
      }
    },
  })
  const [openKey, setOpenKey] = useState<number | null>(null)
  const [metaOpen, setMetaOpen] = useState(false)

  useEffect(() => {
    if (id) void editor.loadArticle(id)
    else editor.startNew(kind)
    // Once per route: the route is the article.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, kind])

  const { draft } = editor
  if (!draft) {
    const { status } = editor
    return status ? (
      <p role="status" className={'meta ' + (status.kind === 'err' ? 'text-danger' : '')}>{status.msg}</p>
    ) : null
  }
  /* `draft.kind`, not the `kind` prop: a kind change after a create updates
     the URL in place rather than remounting, so the prop can be stale. */
  const onDeleted = () => router.push(draft.kind === 'knowledge' ? '/learn' : '/blog')

  return (
    <>
      <div className="flex flex-wrap-reverse items-end gap-y-8 gap-x-[clamp(2rem,3.5vw,4rem)] pb-44 lg:pb-0">
        <article className="lab-article min-w-0 max-w-[46rem] flex-1 basis-[32.5rem]" lang={ARTICLE_LANG}>
          <label className="sr-only" htmlFor="ed-title">{t('title')}</label>
          <textarea
            id="ed-title"
            value={draft.title}
            onChange={(e) => editor.edit({ title: e.target.value.replace(/\n/g, ' ') })}
            rows={2}
            /* Not `AREA`: it carries `leading-relaxed`, which wins over a
               `leading-[…]` utility by stylesheet order, so the h1's own
               leading never applied. Spelled out instead of combined. */
            className="w-full px-4 py-3 surface-sunken text-ink resize-y placeholder:text-ink-faint text-display font-semibold tracking-[-0.02em] leading-[1.15]"
          />
          <label className="sr-only" htmlFor="ed-dek">{t('dek')}</label>
          <textarea
            id="ed-dek"
            value={draft.dek}
            onChange={(e) => editor.edit({ dek: e.target.value })}
            rows={2}
            className="mt-4 w-full px-4 py-3 surface-sunken text-ink resize-y placeholder:text-ink-faint text-title-3 leading-[1.5]"
          />
          <p className={`meta mt-1 text-right tabular-nums ${draft.dek.length > 220 ? 'text-danger' : ''}`}>{draft.dek.length}/220</p>
          <hr className="seam mt-6 mb-6" />

          <BlockInserter onInsert={(type) => setOpenKey(editor.insertBlock(type, 0))} />
          {draft.blocks.map(({ key, block }, i) => (
            <div key={key}>
              <EditableBlock
                block={block}
                index={i}
                open={openKey === key}
                onOpen={() => setOpenKey(key)}
                onClose={() => setOpenKey(null)}
                onChange={(next) => editor.setBlock(key, next)}
                onAsset={(field, assetId) => editor.setAsset(draft.session, key, field, assetId)}
                onMove={(by) => editor.moveBlock(key, by)}
                onRemove={() => {
                  editor.removeBlock(key)
                  setOpenKey(null)
                }}
                first={i === 0}
                last={i === draft.blocks.length - 1}
                upload={editor.upload}
                previews={editor.previews}
                canUpload={draft.id !== null}
              />
              <BlockInserter onInsert={(type) => setOpenKey(editor.insertBlock(type, i + 1))} />
            </div>
          ))}

          <footer className="mt-6 flex flex-col gap-4">
            <hr className="seam" />
            <button type="button" onClick={() => setMetaOpen((o) => !o)} aria-expanded={metaOpen} className="btn-glass self-start">
              {t('metaHeading')}
            </button>
            {metaOpen ? (
              <MetaEditor
                kind={draft.kind}
                meta={draft.meta}
                onChange={(meta) => editor.edit({ meta })}
                refs={editor.refs}
                refsFailed={editor.refsFailed}
                unknownRefs={editor.unknownRefs}
              />
            ) : null}
          </footer>
        </article>

        <EditorRail editor={editor} onDeleted={onDeleted} />
      </div>
      <EditorBottomBar editor={editor} onDeleted={onDeleted} />
    </>
  )
}

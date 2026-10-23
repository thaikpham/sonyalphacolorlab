'use client'

import { useEffect } from 'react'
import { useTranslations } from 'next-intl'
import type { Block } from '@/lib/lab/types'
import { BlockFields, type AssetField, type UploadFn } from '../admin/block-editor'
import { BlockPreview } from './block-preview'

/**
 * One block of the page being edited. Closed, it is the reader's block; a
 * click on it, or its Sửa khối button, swaps it for its fields in the same
 * slot. The draft keeps every change whether the block is closed with Xong,
 * with Escape, or by opening another one.
 */
export function EditableBlock(props: {
  block: Block
  index: number
  open: boolean
  onOpen: () => void
  onClose: () => void
  onChange: (b: Block) => void
  onAsset: (field: AssetField, assetId: string | undefined) => void
  onMove: (by: -1 | 1) => void
  onRemove: () => void
  first: boolean
  last: boolean
  upload: UploadFn
  previews: Readonly<Record<string, string>>
  canUpload: boolean
}) {
  const { block, index, open, onOpen, onClose } = props
  const t = useTranslations('labAdmin')

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return open ? (
    <section className="surface mb-7 flex flex-col gap-4 px-5 py-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="chip bg-accent-900 font-semibold uppercase tracking-[0.08em] text-ink">
          {t(`blocks.${block.t}` as never)}
        </span>
        <span className="flex-1" />
        <button type="button" onClick={() => props.onMove(-1)} disabled={props.first} className="chip chip-action disabled:opacity-30" aria-label={t('moveUp')}>↑</button>
        <button type="button" onClick={() => props.onMove(1)} disabled={props.last} className="chip chip-action disabled:opacity-30" aria-label={t('moveDown')}>↓</button>
        <button type="button" onClick={props.onRemove} className="chip chip-action text-danger">{t('removeBlock')}</button>
        <button type="button" onClick={onClose} className="btn-glass">{t('doneBlock')}</button>
      </div>
      <BlockFields
        block={block}
        onChange={props.onChange}
        onAsset={props.onAsset}
        upload={props.upload}
        previews={props.previews}
        canUpload={props.canUpload}
      />
    </section>
  ) : (
    <div className="group relative -mx-3 cursor-pointer rounded-md px-3 pt-1 transition-colors pointer-fine:hover:bg-glass" onClick={onOpen}>
      <BlockPreview block={block} index={index} previews={props.previews} />
      <button
        type="button"
        onClick={onOpen}
        aria-expanded={open}
        className="chip chip-action absolute right-2 top-2 pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 focus-visible:opacity-100"
      >
        {t('editBlock')}
      </button>
    </div>
  )
}

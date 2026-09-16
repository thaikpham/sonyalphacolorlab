'use client'

import { useId, useState } from 'react'
import { useTranslations } from 'next-intl'
import { parseEmbedUrl } from '@/lib/lab/parse'
import type { Block } from '@/lib/lab/types'
import { AREA, FIELD, FIELD_SM } from '@/components/admin-ui/controls'

/**
 * One block's fields, for every block type in the vocabulary.
 *
 * The editor never offers a free-form body. That is the whole design: an
 * article is a list of ten known shapes, `ARTICLE-SPEC.md` says content that
 * fits none of them is rewritten as a paragraph, and a rich-text box would
 * quietly reintroduce the eleventh block as a `<div>` full of pasted markup.
 * Typing into named fields is also what makes the rail's derived précis, the
 * checklist's persistence and the comparison's labels possible at all — none
 * of those can be recovered from a blob of HTML.
 *
 * Edits are immutable throughout: `onChange` receives a whole new block rather
 * than mutating the one passed in. The block types are `readonly` (a TL;DR is
 * a three-tuple, a table row is a three-tuple) and the parent holds them in
 * React state, so a mutation would be invisible to both the compiler and the
 * renderer.
 */

export type UploadResult = { assetId: string; previewUrl: string }

/**
 * Uploading returns an identity and a way to look at it, not a URL to store.
 *
 * The block persists `assetId` only. `previewUrl` is signed, expires in ten
 * minutes, and is editor-only state — writing it into the article would put a
 * credential-bearing URL in a `jsonb` column and a dead link on the page an
 * hour later.
 */
export type UploadFn = (file: File) => Promise<UploadResult | null>

/** Every block type, in the order the "add block" row offers them — the order
    an article is actually built in, not alphabetical. */
export const BLOCK_TYPES: readonly Block['t'][] = [
  'p',
  'h',
  'menu',
  'callout',
  'table',
  'checklist',
  'compare',
  'figure',
  'embed',
  'tldr',
]

/**
 * A new block of each type, pre-filled where a default is genuinely the right
 * answer and empty where it is not.
 *
 * A `menu` opens with `MENU → ` on both sides because the separator is checked
 * on publish and an editor typing the arrow by hand gets it wrong; a `table`
 * and a `checklist` open at three rows because three is the spec's floor, so
 * the default shape is the smallest publishable one rather than one the editor
 * has to grow before it can be saved.
 */
export function emptyBlock(t: Block['t']): Block {
  switch (t) {
    case 'tldr':
      return { t: 'tldr', items: ['', '', ''] }
    case 'h':
      return { t: 'h', text: '' }
    case 'p':
      return { t: 'p', text: '' }
    case 'menu':
      return { t: 'menu', old: 'MENU → ', new: 'MENU → ' }
    case 'table':
      return {
        t: 'table',
        head: ['', '', ''],
        rows: [
          ['', '', ''],
          ['', '', ''],
          ['', '', ''],
        ],
        caption: '',
      }
    case 'callout':
      return { t: 'callout', label: '', text: '' }
    case 'compare':
      return { t: 'compare', beforeLabel: '', afterLabel: '', caption: '' }
    case 'checklist':
      return { t: 'checklist', label: '', items: ['', '', ''] }
    case 'figure':
      return { t: 'figure', caption: '', alt: '' }
    case 'embed':
      return { t: 'embed', provider: 'youtube', id: '', caption: '' }
  }
}

function Labelled({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="label">{label}</span>
        {hint ? <span className="meta">{hint}</span> : null}
      </div>
      {children}
    </div>
  )
}

/**
 * One image slot: upload a file, and that is the only way in.
 *
 * The paste-a-path field is gone, and its absence is the design. A block stores
 * an asset UUID now, so there is nothing meaningful to type — and the field it
 * replaced accepted a URL, which is how an article body came to carry a
 * project-specific Storage host in the first place. Everything that renders
 * here came through the processor: bounded, re-encoded, stripped of metadata,
 * owned by a row.
 *
 * Upload needs a saved article to belong to. `lab_assets.article_id` is NOT
 * NULL and the foreign key is RESTRICT, so an asset uploaded against a draft
 * that does not exist yet has nowhere to go; the control says so rather than
 * failing at the server.
 */
function ImageSlot({
  label,
  assetId,
  previews,
  canUpload,
  onChange,
  upload,
}: {
  label: string
  assetId: string | undefined
  /** id → short-lived signed URL, refetched with the article. Never persisted. */
  previews: Readonly<Record<string, string>>
  /** False until the article has been saved once and therefore has an id. */
  canUpload: boolean
  onChange: (next: string | undefined) => void
  upload: UploadFn
}) {
  const t = useTranslations('labAdmin')
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  /* Held here, beside the upload that produced it, rather than lifted into the
     draft: it expires, and a draft is what gets written to the database. */
  const [fresh, setFresh] = useState<string | null>(null)
  const id = useId()
  const preview = fresh ?? (assetId ? previews[assetId] : undefined)

  async function pick(file: File | undefined) {
    if (!file) return
    setBusy(true)
    setFailed(false)
    const result = await upload(file)
    setBusy(false)
    if (!result) {
      setFailed(true)
      return
    }
    setFresh(result.previewUrl)
    onChange(result.assetId)
  }

  return (
    <Labelled label={label}>
      <div className="flex flex-col gap-2">
        {preview ? (
          /* A plain <img>: the signed URL expires, so it must never reach the
             image loader's rung rewriting or a cache that outlives it. */
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt=""
            className="surface-sunken aspect-video w-full rounded-md object-cover"
          />
        ) : assetId ? (
          <p className="meta">{t('imagePreviewExpired')}</p>
        ) : (
          <p className="meta">{t('imageNone')}</p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {/* A label, not a button wrapping a hidden input: the native pairing
              is what gives the control keyboard focus and the file dialog for
              free. `sr-only` rather than `hidden`, which removes it from the
              accessibility tree along with the click target. */}
          <label
            htmlFor={id}
            className="btn-glass cursor-pointer text-label aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
            aria-disabled={busy || !canUpload}
          >
            {busy ? t('uploading') : t('uploadFile')}
          </label>
          <input
            id={id}
            type="file"
            /* No GIF. It bypassed the optimizer and was served whole, so a
               40 MB screen recording was one drag-and-drop away; the processor
               refuses it and a CHECK constraint on `lab_assets` refuses it
               again. Saying so in the picker is kinder than a 415. */
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            disabled={busy || !canUpload}
            onChange={(e) => {
              void pick(e.target.files?.[0])
              // Cleared so re-picking the same file fires `change` again.
              e.target.value = ''
            }}
          />
          {assetId ? (
            <button
              type="button"
              onClick={() => {
                setFresh(null)
                onChange(undefined)
              }}
              className="chip chip-action"
            >
              {t('clearImage')}
            </button>
          ) : null}
          {!canUpload ? <span className="meta">{t('saveBeforeUpload')}</span> : null}
          {failed ? <span className="meta text-danger">{t('uploadFailed')}</span> : null}
        </div>
      </div>
    </Labelled>
  )
}

export function BlockFields({
  block,
  onChange,
  upload,
  previews,
  canUpload,
}: {
  block: Block
  onChange: (next: Block) => void
  upload: UploadFn
  previews: Readonly<Record<string, string>>
  canUpload: boolean
}) {
  const t = useTranslations('labAdmin')

  switch (block.t) {
    case 'tldr':
      return (
        <Labelled label={t('tldrLines')} hint={t('tldrHint')}>
          <div className="flex flex-col gap-2">
            {block.items.map((item, i) => (
              <input
                key={i}
                type="text"
                value={item}
                onChange={(e) => {
                  /* Rebuilt as a fresh three-tuple. `items[i] = x` would be a
                     write to a `readonly` tuple React never sees change. */
                  const next = [...block.items] as [string, string, string]
                  next[i] = e.target.value
                  onChange({ ...block, items: next })
                }}
                placeholder={t('tldrLineN', { n: i + 1 })}
                className={FIELD_SM}
              />
            ))}
          </div>
        </Labelled>
      )

    case 'h':
      return (
        <Labelled label={t('headingText')} hint={t('headingHint')}>
          <input
            type="text"
            value={block.text}
            onChange={(e) => onChange({ ...block, text: e.target.value })}
            className={FIELD}
          />
        </Labelled>
      )

    case 'p':
      return (
        <Labelled label={t('paragraphText')}>
          <textarea
            value={block.text}
            onChange={(e) => onChange({ ...block, text: e.target.value })}
            rows={5}
            className={AREA}
          />
        </Labelled>
      )

    case 'menu':
      return (
        <div className="grid gap-3 md:grid-cols-2">
          <Labelled label={t('menuOld')} hint={t('menuOldBodies')}>
            <input
              type="text"
              value={block.old}
              onChange={(e) => onChange({ ...block, old: e.target.value })}
              className={FIELD_SM}
            />
          </Labelled>
          <Labelled label={t('menuNew')} hint={t('menuNewBodies')}>
            <input
              type="text"
              value={block.new}
              onChange={(e) => onChange({ ...block, new: e.target.value })}
              className={FIELD_SM}
            />
          </Labelled>
        </div>
      )

    case 'table':
      return (
        <div className="flex flex-col gap-3">
          <Labelled label={t('tableHead')} hint={t('tableHeadHint')}>
            <div className="grid gap-2 sm:grid-cols-3">
              {block.head.map((cell, i) => (
                <input
                  key={i}
                  type="text"
                  value={cell}
                  onChange={(e) => {
                    const head = [...block.head] as [string, string, string]
                    head[i] = e.target.value
                    onChange({ ...block, head })
                  }}
                  className={FIELD_SM}
                />
              ))}
            </div>
          </Labelled>

          <Labelled label={t('tableRows')} hint={t('tableRowsHint')}>
            <div className="flex flex-col gap-2">
              {block.rows.map((row, r) => (
                <div key={r} className="flex items-start gap-2">
                  <div className="grid flex-1 gap-2 sm:grid-cols-3">
                    {row.map((cell, c) => (
                      <input
                        key={c}
                        type="text"
                        value={cell}
                        onChange={(e) => {
                          const rows = block.rows.map((existing, ri) => {
                            if (ri !== r) return existing
                            const copy = [...existing] as [string, string, string]
                            copy[c] = e.target.value
                            return copy
                          })
                          onChange({ ...block, rows })
                        }}
                        className={FIELD_SM}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => onChange({ ...block, rows: block.rows.filter((_, ri) => ri !== r) })}
                    className="chip chip-action shrink-0"
                    aria-label={t('removeRowN', { n: r + 1 })}
                  >
                    {t('removeRow')}
                  </button>
                </div>
              ))}
              <div>
                <button
                  type="button"
                  onClick={() => onChange({ ...block, rows: [...block.rows, ['', '', '']] })}
                  className="chip chip-action"
                >
                  {t('addRow')}
                </button>
              </div>
            </div>
          </Labelled>

          <Labelled label={t('tableCaption')} hint={t('tableCaptionHint')}>
            <input
              type="text"
              value={block.caption}
              onChange={(e) => onChange({ ...block, caption: e.target.value })}
              className={FIELD_SM}
            />
          </Labelled>
        </div>
      )

    case 'callout':
      return (
        <div className="flex flex-col gap-3">
          <Labelled label={t('calloutLabel')} hint={t('calloutLabelHint')}>
            <input
              type="text"
              value={block.label}
              onChange={(e) => onChange({ ...block, label: e.target.value })}
              className={FIELD_SM}
            />
          </Labelled>
          <Labelled label={t('calloutText')}>
            <textarea
              value={block.text}
              onChange={(e) => onChange({ ...block, text: e.target.value })}
              rows={4}
              className={AREA}
            />
          </Labelled>
        </div>
      )

    case 'compare':
      return (
        <div className="flex flex-col gap-3">
          <div className="grid gap-3 md:grid-cols-2">
            <Labelled label={t('compareBeforeLabel')} hint={t('compareLabelHint')}>
              <input
                type="text"
                value={block.beforeLabel}
                onChange={(e) => onChange({ ...block, beforeLabel: e.target.value })}
                placeholder="1/30, ISO 400"
                className={FIELD_SM}
              />
            </Labelled>
            <Labelled label={t('compareAfterLabel')} hint={t('compareLabelHint')}>
              <input
                type="text"
                value={block.afterLabel}
                onChange={(e) => onChange({ ...block, afterLabel: e.target.value })}
                placeholder="1/125, ISO 1600"
                className={FIELD_SM}
              />
            </Labelled>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <ImageSlot
              label={t('compareBeforeImage')}
              assetId={block.beforeAssetId}
              previews={previews}
              canUpload={canUpload}
              onChange={(beforeAssetId) => onChange({ ...block, beforeAssetId })}
              upload={upload}
            />
            <ImageSlot
              label={t('compareAfterImage')}
              assetId={block.afterAssetId}
              previews={previews}
              canUpload={canUpload}
              onChange={(afterAssetId) => onChange({ ...block, afterAssetId })}
              upload={upload}
            />
          </div>
          {/* Stated rather than left to be discovered: the slider renders
              nothing at all until both halves exist, so a comparison with one
              image looks to the editor like a block that vanished. */}
          {!block.beforeAssetId || !block.afterAssetId ? (
            <p className="meta text-community">{t('compareNeedsBoth')}</p>
          ) : null}
          <Labelled label={t('compareCaption')}>
            <input
              type="text"
              value={block.caption}
              onChange={(e) => onChange({ ...block, caption: e.target.value })}
              className={FIELD_SM}
            />
          </Labelled>
        </div>
      )

    case 'checklist':
      return (
        <div className="flex flex-col gap-3">
          <Labelled label={t('checklistLabel')}>
            <input
              type="text"
              value={block.label}
              onChange={(e) => onChange({ ...block, label: e.target.value })}
              className={FIELD_SM}
            />
          </Labelled>
          <Labelled label={t('checklistItems')} hint={t('checklistItemsHint')}>
            <div className="flex flex-col gap-2">
              {block.items.map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={item}
                    onChange={(e) => {
                      const items = block.items.map((existing, ii) =>
                        ii === i ? e.target.value : existing,
                      )
                      onChange({ ...block, items })
                    }}
                    className={FIELD_SM}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      onChange({ ...block, items: block.items.filter((_, ii) => ii !== i) })
                    }
                    className="chip chip-action shrink-0"
                    aria-label={t('removeItemN', { n: i + 1 })}
                  >
                    {t('removeItem')}
                  </button>
                </div>
              ))}
              <div>
                <button
                  type="button"
                  onClick={() => onChange({ ...block, items: [...block.items, ''] })}
                  className="chip chip-action"
                >
                  {t('addItem')}
                </button>
              </div>
            </div>
          </Labelled>
        </div>
      )

    case 'figure':
      return (
        <div className="flex flex-col gap-3">
          <ImageSlot
            label={t('figureImage')}
            assetId={block.assetId}
            previews={previews}
            canUpload={canUpload}
            onChange={(assetId) => onChange({ ...block, assetId })}
            upload={upload}
          />
          <Labelled label={t('figureCaption')} hint={t('figureCaptionHint')}>
            <input
              type="text"
              value={block.caption}
              onChange={(e) => onChange({ ...block, caption: e.target.value })}
              className={FIELD_SM}
            />
          </Labelled>
          <Labelled label={t('figureAlt')} hint={t('figureAltHint')}>
            <input
              type="text"
              value={block.alt ?? ''}
              onChange={(e) => onChange({ ...block, alt: e.target.value })}
              className={FIELD_SM}
            />
          </Labelled>
        </div>
      )

    case 'embed':
      return <EmbedFields block={block} onChange={onChange} />
  }
}

/**
 * The video field, which takes a URL and stores something else.
 *
 * The editor pastes whatever their browser gave them; `parseEmbedUrl` reduces
 * it to a provider and an id, and only those two are kept. What is shown back
 * is the resolved pair, not the pasted string — so an editor can see that the
 * playlist, the timestamp and the tracking parameters did not survive, which
 * is the behaviour and not a side effect of it.
 */
function EmbedFields({
  block,
  onChange,
}: {
  block: Extract<Block, { t: 'embed' }>
  onChange: (next: Block) => void
}) {
  const t = useTranslations('labAdmin')
  const [raw, setRaw] = useState('')
  const [failed, setFailed] = useState(false)

  function apply(value: string) {
    setRaw(value)
    if (!value.trim()) {
      setFailed(false)
      return
    }
    const parsed = parseEmbedUrl(value)
    if (!parsed) {
      setFailed(true)
      return
    }
    setFailed(false)
    onChange({ ...block, provider: parsed.provider, id: parsed.id })
  }

  return (
    <div className="flex flex-col gap-3">
      <Labelled label={t('embedUrl')} hint={t('embedUrlHint')}>
        <input
          type="url"
          value={raw}
          onChange={(e) => apply(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=…"
          className={FIELD_SM}
        />
      </Labelled>

      {failed ? <p className="meta text-danger">{t('embedUnrecognised')}</p> : null}

      {block.id ? (
        <p className="meta">
          {t('embedResolved')}{' '}
          <span className="text-ink tabular-nums">
            {block.provider} · {block.id}
          </span>
        </p>
      ) : (
        <p className="meta text-community">{t('embedNeedsId')}</p>
      )}

      <Labelled label={t('embedCaption')} hint={t('embedCaptionHint')}>
        <input
          type="text"
          value={block.caption}
          onChange={(e) => onChange({ ...block, caption: e.target.value })}
          className={FIELD_SM}
        />
      </Labelled>
    </div>
  )
}

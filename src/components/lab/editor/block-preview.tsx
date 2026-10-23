'use client'

import { useTranslations } from 'next-intl'
import type { Block } from '@/lib/lab/types'
import {
  ArticleEmbed, BLOCK_GAP, Callout, ComparisonTable, Heading, MenuPair, Paragraph, TldrCard,
} from '../blocks'

/**
 * A block as the reader will see it, inside the editor.
 *
 * The reader's renderers wherever they can be used as they are. Three cannot:
 * a figure and a comparison in a draft live in the private bucket, so they are
 * drawn from the editor's signed previews (plain `<img>`: the URLs expire and
 * must not reach the image loader); a checklist here must not write ticks into
 * the reader's storage. A block with nothing in it yet shows its type.
 */
export function BlockPreview({
  block,
  index,
  previews,
}: {
  block: Block
  index: number
  previews: Readonly<Record<string, string>>
}) {
  const t = useTranslations('labAdmin')
  const empty = (
    <p className={`${BLOCK_GAP} surface-sunken px-5 py-4 meta`}>{t(`blocks.${block.t}` as never)}</p>
  )

  switch (block.t) {
    case 'tldr':
      /* `summary`, the reader's word for the card, not the field's `tldrLines`. */
      return block.items.some((s) => s.trim()) ? <TldrCard block={block} label={t('summary')} /> : empty
    case 'h':
      return block.text.trim() ? <Heading block={block} index={index} /> : empty
    case 'p':
      return block.text.trim() ? <Paragraph block={block} /> : empty
    case 'menu':
      return <MenuPair block={block} labels={{ old: t('menuOld'), new: t('menuNew') }} />
    case 'table':
      return <ComparisonTable block={block} />
    case 'callout':
      return block.text.trim() ? <Callout block={block} /> : empty
    case 'embed':
      return block.id ? <ArticleEmbed block={block} /> : empty
    case 'figure': {
      const src = block.assetId ? previews[block.assetId] : undefined
      if (!src) return empty
      return (
        <figure className={BLOCK_GAP}>
          {/* The surface on a wrapper, whole, as the reader's `ArticleFigure`;
              the picture fills it. A surface class is an elevation, and the
              `rounded-*` that sat beside it on the `<img>` was dead. */}
          <div className="surface-sunken aspect-video overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={block.alt ?? ''} className="h-full w-full object-cover" />
          </div>
          <figcaption className="meta mt-2">{block.caption}</figcaption>
        </figure>
      )
    }
    case 'compare': {
      const before = block.beforeAssetId ? previews[block.beforeAssetId] : undefined
      const after = block.afterAssetId ? previews[block.afterAssetId] : undefined
      if (!before || !after) return empty
      return (
        <figure className={BLOCK_GAP}>
          <div className="grid grid-cols-2 gap-2">
            {[{ src: before, label: block.beforeLabel }, { src: after, label: block.afterLabel }].map((half) => (
              <div key={half.label} className="flex flex-col gap-1">
                <div className="surface-sunken aspect-3/2 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={half.src} alt="" className="h-full w-full object-cover" />
                </div>
                <span className="meta tabular-nums">{half.label}</span>
              </div>
            ))}
          </div>
          <figcaption className="meta mt-2">{block.caption}</figcaption>
        </figure>
      )
    }
    case 'checklist':
      return (
        <section className={`${BLOCK_GAP} surface px-5 pt-2 pb-4`}>
          <p className="py-3.5 pb-1.5 text-body-sm font-semibold text-ink-muted">{block.label}</p>
          <ul className="flex flex-col gap-2">
            {block.items.map((item, i) => (
              <li key={i} className="text-body text-ink">{item}</li>
            ))}
          </ul>
        </section>
      )
    default: {
      const unreachable: never = block
      return unreachable
    }
  }
}

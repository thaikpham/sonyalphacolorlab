'use client'

import { useId, useState } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import type { CompareBlock } from '@/lib/lab/types'
import { BLOCK_GAP } from './blocks'

/**
 * The before/after wipe.
 *
 * Both labels carry real parameter values ("1/30, ISO 400") rather than
 * "Trước"/"Sau" — ARTICLE-SPEC makes that a hard rule, because the settings
 * are the entire point of the comparison and a reader should be able to read
 * them off the two halves without hunting in the caption.
 *
 * The control is a native `input[type=range]`, not a drag handle on the image.
 * A range input is keyboard-operable, announces its value, and honours the
 * platform's own pointer behaviour on touch; a custom handle is three of those
 * things reimplemented badly. Position is ephemeral by design — the handoff
 * says do not persist it, and a wipe frozen at 3% on return would look broken.
 */
export function CompareSlider({ block }: { block: CompareBlock }) {
  const [value, setValue] = useState(50)
  const id = useId()
  const t = useTranslations('lab')

  /* Nothing to wipe between until both frames exist, and the caption cannot
     stand in for them: every one of these opens by telling the reader to drag
     a control that would not be on the page. The block waits for its
     photography rather than shipping an instruction to nowhere. */
  if (!block.before || !block.after) return null

  return (
    <figure className={BLOCK_GAP}>
      <div className="surface-sunken relative aspect-3/2 overflow-hidden rounded-lg">
        <Image
          src={block.after}
          alt={block.afterLabel}
          fill
          sizes="(max-width: 48rem) 100vw, 40rem"
          className="object-cover"
        />
        {/* The "before" frame is clipped from the right, so 0 shows all of
            "after" and 100 shows all of "before" — the same direction the
            divider travels. */}
        <div
          className="absolute inset-0"
          style={{ clipPath: `inset(0 ${100 - value}% 0 0)` }}
        >
          <Image
            src={block.before}
            alt={block.beforeLabel}
            fill
            sizes="(max-width: 48rem) 100vw, 40rem"
            className="object-cover"
          />
        </div>
        <span
          aria-hidden
          className="absolute inset-y-0 w-0.5 bg-white shadow-[0_0_12px_oklch(0%_0_0_/_0.6)]"
          style={{ left: `${value}%` }}
        />
        {/* Both labels sit on a near-void scrim so they stay legible over a
            blown highlight as well as over a shadow. */}
        <span className="chip absolute top-3 left-3 bg-void/60 text-white uppercase tracking-[0.08em] font-semibold">
          {block.beforeLabel}
        </span>
        <span className="chip absolute top-3 right-3 bg-void/60 text-white uppercase tracking-[0.08em] font-semibold">
          {block.afterLabel}
        </span>
      </div>

      <label htmlFor={id} className="sr-only">
        {t('compareControl', { before: block.beforeLabel, after: block.afterLabel })}
      </label>
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
        className="mt-2 min-h-[var(--layout-touch-target)] w-full cursor-pointer accent-[var(--color-accent-500)]"
      />
      <figcaption className="meta">{block.caption}</figcaption>
    </figure>
  )
}

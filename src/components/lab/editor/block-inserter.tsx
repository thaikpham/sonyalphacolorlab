'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import type { Block } from '@/lib/lab/types'
import { BLOCK_TYPES } from '../admin/block-editor'

/**
 * The seam between two blocks, and the way to put a new one there. Hidden
 * until hover or focus on a fine pointer; always there on touch, where there
 * is no hover to reveal it.
 */
export function BlockInserter({ onInsert }: { onInsert: (type: Block['t']) => void }) {
  const t = useTranslations('labAdmin')
  const [choosing, setChoosing] = useState(false)

  return (
    <div
      className={
        'my-1 flex flex-col items-center gap-2 transition-opacity ' +
        /* Once choosing, the button that held focus is gone, so focus-within
           would no longer keep the row visible: it stays shown instead. */
        (choosing ? '' : 'pointer-fine:opacity-0 pointer-fine:hover:opacity-100 focus-within:opacity-100')
      }
    >
      {choosing ? (
        <ul className="flex flex-wrap justify-center gap-2">
          {BLOCK_TYPES.map((type) => (
            <li key={type}>
              <button
                type="button"
                className="chip chip-action"
                onClick={() => {
                  setChoosing(false)
                  onInsert(type)
                }}
              >
                {t(`blocks.${type}` as never)}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <button
          type="button"
          onClick={() => setChoosing(true)}
          className="flex w-full min-h-[var(--layout-touch-target)] items-center gap-3 text-body-sm font-semibold text-accent-400"
        >
          <hr className="seam flex-1" />
          <span>+ {t('addBlock')}</span>
          <hr className="seam flex-1" />
        </button>
      )}
    </div>
  )
}

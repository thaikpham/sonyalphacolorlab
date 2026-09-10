'use client'

import { CHECKS_KEY } from '@/lib/lab/storage'
import { toggleStoredTick, useTicks } from '@/lib/lab/tick-store'
import type { ChecklistBlock } from '@/lib/lab/types'
import { BLOCK_GAP } from './blocks'

/**
 * A tickable checklist whose state survives a reload.
 *
 * State comes from the shared external store rather than from this
 * component's own `useState`, which settles two things at once. An article can
 * carry more than one checklist and they all write the same
 * `alpha-lab-checks-v1` map, so a component-local copy is how the second
 * list's first tick erases the first list's ticks. And the store's server
 * snapshot is empty, so the server's markup and the first client render agree
 * — a checklist read during render would fail hydration and take the whole
 * article down with it.
 */
export function Checklist({
  block,
  articleId,
  blockIndex,
}: {
  block: ChecklistBlock
  articleId: string
  blockIndex: number
}) {
  const ticked = useTicks(CHECKS_KEY)
  const keyFor = (itemIndex: number) => `${articleId}-${blockIndex}-${itemIndex}`

  return (
    <section className={`${BLOCK_GAP} surface px-5 pt-2 pb-4`}>
      <p className="label py-3.5 pb-1.5">{block.label}</p>
      <ul>
        {block.items.map((item, i) => {
          const on = Boolean(ticked[keyFor(i)])
          return (
            <li key={item}>
              {i > 0 ? <hr className="seam" /> : null}
              <button
                type="button"
                onClick={() => toggleStoredTick(CHECKS_KEY, keyFor(i))}
                aria-pressed={on}
                className="flex min-h-[var(--layout-touch-target)] w-full cursor-pointer items-center gap-3 py-2.5 text-left"
              >
                <span
                  aria-hidden
                  className={
                    'grid h-[22px] w-[22px] shrink-0 place-items-center rounded-[7px] ' +
                    (on
                      ? 'bg-accent-500 text-white'
                      : 'bg-sunken shadow-[var(--elevation-inset),var(--elevation-spec)]')
                  }
                >
                  {/* The floor is 13px and this glyph is at it. A tick that
                      recedes does so by ink step, never by size. */}
                  {on ? <span className="text-label font-extrabold leading-none">✓</span> : null}
                </span>
                {/* Ticked text steps down the ink ramp rather than striking
                    through: a line through Vietnamese sits on the diacritics
                    and makes a done item genuinely harder to re-read. */}
                <span className={on ? 'text-body-sm text-ink-faint' : 'text-body-sm text-ink'}>
                  {item}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

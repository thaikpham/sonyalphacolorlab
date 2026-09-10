'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { recapRows, setupSteps } from '@/lib/lab/setup-steps'
import { MENU_VERSION_KEY, SETUP_KEY } from '@/lib/lab/storage'
import {
  setPreference,
  toggleStoredTick,
  usePreference,
  useTicks,
} from '@/lib/lab/tick-store'
import type { MenuVersion } from '@/lib/lab/types'

/**
 * The eight-step setup tool.
 *
 * One responsive tree, not two. The prototype measured `window.innerWidth` in
 * JavaScript and swapped an entire second component below 760px — which is why
 * its two layouts had to share five pieces of state by hand, and why the first
 * paint on a phone was the desktop tree. The handoff itself says to prefer one
 * tree, and everything its mobile layout does differently (one step in view,
 * a compact jump bar) is a job for the sticky header and `scroll-margin`
 * rather than for a width listener.
 *
 * Two pieces of state persist and one does not. Completion persists because
 * the reader is walking their camera through eight menus and will put the
 * phone down halfway. The menu version persists because it is a fact about
 * which camera they own, and asking again every visit is asking them to
 * re-answer a question about their own hardware.
 */
/** `old` is the default: it is the tree on the cheaper, more numerous bodies. */
const MENU_VERSIONS: readonly MenuVersion[] = ['old', 'new']

export function SetupGuide() {
  const t = useTranslations('lab')
  /* Both come from the storage-backed external store, whose server snapshot is
     empty — so the server's markup and the first client render agree, and the
     stored values arrive in the same commit as hydration rather than in a
     second render that flashes every tick off and back on. */
  const version = usePreference<MenuVersion>(MENU_VERSION_KEY, 'old', MENU_VERSIONS)
  const done = useTicks(SETUP_KEY)

  const steps = useMemo(() => setupSteps(version), [version])
  const recap = useMemo(() => recapRows(steps), [steps])

  const doneCount = steps.filter((s) => done[s.id]).length
  const percent = Math.round((doneCount / steps.length) * 100)

  const versions: readonly { readonly id: MenuVersion; readonly label: string; readonly bodies: string }[] = [
    { id: 'old', label: t('menuOld'), bodies: 'a6400 · ZV-E10' },
    { id: 'new', label: t('menuNew'), bodies: 'a6700 · ZV-E10 II' },
  ]

  return (
    <div className="mx-auto w-full max-w-[73.75rem] px-6 pb-24">
      <header className="sticky top-0 z-10 bg-void/95 pt-3.5 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <Link href="/blog" className="text-left">
            <span className="block text-body-lg font-extrabold tracking-[-0.02em] text-ink">
              {t('setupWordmark')}
            </span>
            <span className="label mt-0.5 block">{t('setupSubline')}</span>
          </Link>

          {/* The page's central control: it rewrites every menu path on the
              screen, including the recap. A segmented control rather than two
              buttons because the two options are mutually exclusive readings
              of the same setting, and the rut makes that visible. */}
          <div
            role="radiogroup"
            aria-label={t('menuVersion')}
            className="surface-sunken flex gap-1 p-[3px]"
          >
            {versions.map((v) => {
              const on = version === v.id
              return (
                <button
                  key={v.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setPreference(MENU_VERSION_KEY, v.id)}
                  className={
                    'flex min-h-[var(--layout-touch-target)] cursor-pointer flex-col justify-center rounded-[11px] px-4 py-1.5 text-left transition-colors ' +
                    (on ? 'surface-selected text-white' : 'text-ink-muted hover:text-ink')
                  }
                >
                  <span className="text-label font-semibold uppercase tracking-[0.08em]">
                    {v.label}
                  </span>
                  <span className={on ? 'text-meta text-white/75' : 'meta'}>{v.bodies}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Only the chips scroll. The progress bar and its counter are a
            sibling of the scroll container, not a child of it — inside, `n/8`
            sat past the right edge on a phone and scrolled away, which is the
            one number on the page a reader comes back to check. */}
        <div className="mt-3 flex items-center gap-3 pb-3">
          <ul className="scroll-area flex min-w-0 flex-1 gap-1.5 overflow-x-auto">
            {steps.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.anchor}`}
                  className={
                    'chip chip-action tabular-nums font-extrabold ' +
                    (done[s.id] ? 'text-accent-400' : '')
                  }
                >
                  {s.n}
                </a>
              </li>
            ))}
            <li>
              <a
                href="#recap"
                className="chip chip-action bg-accent-900 font-semibold uppercase tracking-[0.08em] text-accent-300 whitespace-nowrap"
              >
                {t('recap')}
              </a>
            </li>
          </ul>

          <div className="flex shrink-0 items-center gap-3">
            {/* `role="progressbar"` rather than `<progress>`: the native
                element cannot be restyled to a 6px rut on WebKit without
                per-vendor pseudo-elements, and this is the same rut the rest
                of the system uses. */}
            <div
              role="progressbar"
              aria-valuenow={doneCount}
              aria-valuemin={0}
              aria-valuemax={steps.length}
              aria-label={t('progress')}
              /* `.surface-sunken` whole, with the radius overridden — a bare
                 `bg-sunken` is black at 35% on a #07080B ground, which is an
                 empty progress bar nobody can see the shape of. The rut needs
                 its inset shadow and specular highlight to read at 6px. */
              className="surface-sunken h-1.5 w-24 overflow-hidden rounded-full sm:w-40"
            >
              <span
                className="block h-full rounded-full bg-accent-400 transition-[width] duration-200"
                style={{ width: `${percent}%` }}
              />
            </div>
            <span className="text-label font-extrabold tabular-nums text-ink">
              {doneCount}/{steps.length}
            </span>
          </div>
        </div>
        <hr className="seam" />
      </header>

      <section className="py-10 sm:py-14">
        <p className="label text-accent-400">{t('setupKicker')}</p>
        <h1 className="mt-3 max-w-[16ch] text-[clamp(2.125rem,5.4vw,3.5rem)] font-extrabold leading-[1.05] tracking-[-0.02em] text-ink [text-wrap:pretty]">
          {t('setupTitle')}
        </h1>
        <p className="mt-4 max-w-[56ch] text-body-lg text-ink-muted [text-wrap:pretty]">
          {t('setupLede')}
        </p>

        <dl className="mt-10 flex flex-wrap gap-4">
          {[
            { k: t('statTime'), v: t('statTimeValue') },
            { k: t('statVersion'), v: version === 'new' ? t('menuNew') : t('menuOld') },
            { k: t('statApplies'), v: version === 'new' ? 'a6700 · ZV-E10 II' : 'a6400 · ZV-E10' },
          ].map((cell) => (
            <div key={cell.k} className="surface flex-1 basis-50 px-5 py-4">
              <dt className="label">{cell.k}</dt>
              <dd className="mt-1 text-title-3 font-extrabold text-ink">{cell.v}</dd>
            </div>
          ))}
        </dl>
      </section>
      <hr className="seam" />

      {steps.map((step) => {
        const on = Boolean(done[step.id])
        return (
          <section key={step.id} id={step.anchor} className="scroll-mt-[8.75rem] py-11">
            <div className="flex flex-wrap gap-x-8 gap-y-6">
              <div className="flex basis-16 flex-row items-center gap-4 sm:flex-col sm:items-start sm:gap-3">
                <span
                  aria-hidden
                  className="text-[2.75rem] font-extrabold leading-[0.85] tabular-nums text-accent-400"
                >
                  {step.n}
                </span>
                <button
                  type="button"
                  onClick={() => toggleStoredTick(SETUP_KEY, step.id)}
                  aria-pressed={on}
                  className="flex min-h-[var(--layout-touch-target)] min-w-[var(--layout-touch-target)] cursor-pointer items-center sm:justify-start"
                >
                  <span className="sr-only">{t('markDone', { title: step.title })}</span>
                  {/* Unchecked is a raised glass film, not `sunken`.
                      `sunken` means pressed INTO the surface it sits on, and
                      this box sits directly on the void — black at 35% over
                      #07080B is an empty square nobody can find, which on the
                      one control that records eight steps of progress is not
                      a subtlety. Inside a checklist card `sunken` is correct
                      and stays; there the box has a lighter surface to be
                      pressed into. */}
                  <span
                    aria-hidden
                    className={
                      'grid h-[22px] w-[22px] place-items-center rounded-lg ' +
                      (on
                        ? 'bg-accent-500 text-white'
                        : 'bg-glass-raised shadow-[var(--elevation-spec)]')
                    }
                  >
                    {on ? <span className="text-label font-extrabold leading-none">✓</span> : null}
                  </span>
                </button>
              </div>

              <div className="min-w-0 flex-1 basis-95">
                <p className="label">{step.kicker}</p>
                <h2 className="mt-2 text-[clamp(1.5625rem,3vw,2rem)] font-extrabold leading-[1.15] tracking-[-0.02em] text-ink [text-wrap:pretty]">
                  {step.title}
                </h2>

                <ul className="mt-5">
                  {step.settings.map((s) => (
                    <li key={s.label}>
                      <hr className="seam" />
                      <div className="py-3.5">
                        <p className="text-body font-extrabold text-ink">{s.label}</p>
                        <p className="mt-1 text-body text-accent-400">{s.value}</p>
                        <p className="mt-1 text-body-sm break-words text-ink-muted">{s.path}</p>
                      </div>
                    </li>
                  ))}
                </ul>

                <p className="mt-4 text-body text-ink-muted [text-wrap:pretty]">{step.why}</p>

                {step.tip ? (
                  <aside className="surface-raised mt-6 px-[22px] py-5">
                    <p className="label text-accent-400">{step.tip.title}</p>
                    <p className="mt-1.5 text-body text-ink [text-wrap:pretty]">{step.tip.body}</p>
                    <ul className="mt-4">
                      {step.tip.settings.map((s) => (
                        <li key={s.label}>
                          <hr className="seam" />
                          <div className="py-3">
                            <p className="text-body-sm font-semibold text-ink">{s.label}</p>
                            <p className="mt-1 text-body-sm break-words text-ink-muted">{s.path}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </aside>
                ) : null}
              </div>
            </div>
            <hr className="seam mt-11" />
          </section>
        )
      })}

      <section id="recap" className="scroll-mt-[8.75rem] pt-10">
        <p className="label text-accent-400">{t('recap')}</p>
        <h2 className="mt-2 text-title-1 font-extrabold tracking-[-0.02em] text-ink">
          {t('recapTitle')}
        </h2>
        <p className="mt-3 max-w-[56ch] text-body text-ink-muted">
          {version === 'new' ? t('recapNoteNew') : t('recapNoteOld')}
        </p>

        <div className="surface scroll-area mt-6 overflow-x-auto rounded-md">
          <table className="w-full min-w-[44rem] border-separate border-spacing-0 text-left">
            <thead>
              <tr className="bg-sunken">
                <th scope="col" className="label px-4 py-3 w-[8%]">
                  #
                </th>
                <th scope="col" className="label px-4 py-3 w-[26%]">
                  {t('recapSetting')}
                </th>
                <th scope="col" className="label px-4 py-3 w-[20%]">
                  {t('recapValue')}
                </th>
                <th scope="col" className="label px-4 py-3">
                  {t('recapPath')}
                </th>
              </tr>
            </thead>
            <tbody>
              {recap.map((row, i) => (
                <tr key={`${row.n}-${row.label}`} className={i % 2 === 1 ? 'row-tint' : undefined}>
                  <td className="px-4 py-3 text-body-sm tabular-nums text-ink-faint">{row.n}</td>
                  <th scope="row" className="px-4 py-3 text-body-sm font-semibold text-ink">
                    {row.label}
                  </th>
                  <td className="px-4 py-3 text-body-sm text-accent-400">{row.value}</td>
                  <td className="px-4 py-3 text-body-sm break-words text-ink-muted">{row.path}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="meta mt-4">{t('firmwareDisclaimer')}</p>
      </section>
    </div>
  )
}

import { Fragment } from 'react'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { modelCode } from '@/lib/cameras/aliases'
import { getSonyCameras } from '@/lib/cameras/data'
import type { Assessment, Outcome, Verdict } from '@/lib/cameras/capabilities/engine'
import type { ShootingMode } from '@/lib/cameras/capabilities/evidence'
import { summariseFeatures } from '@/lib/cameras/capabilities/features'
import {
  EVIDENCED_CAMERAS,
  SHOOTING_MODES,
  assessRecipe,
  capabilitiesOf,
  sourcesOf,
} from '@/lib/cameras/capabilities/index'
import { capabilityLabel, type RecipeSettings } from '@/lib/cameras/capabilities/keys'
import { productTitle } from '@/lib/content/relations'
import { listRecipes, type Locale } from '@/lib/recipes/source'
import type { SourceRef } from '@/lib/lab/types'
import { SourceList } from '@/components/content/source-list'

/**
 * Which bodies a recipe works on, and what a body's colour menus hold — both
 * from `src/lib/cameras/capabilities`, which counts only claims a live check
 * of Sony's Help Guide confirmed (ADR 0005).
 *
 * Neither section renders without evidence: a recipe page listing "not
 * verified" against bodies nobody has checked would be a to-do list, not
 * information.
 */

/** The catalogue product for each evidenced model code. A failed catalogue read
    costs the links and the marketing names, never the verdicts: those come
    from the evidence, and the model code is a true name for the body. */
async function productsByModel(): Promise<Map<string, { id: string; title: string }>> {
  try {
    const cameras = await getSonyCameras()
    return new Map(cameras.map((c) => [modelCode(c.sku), { id: c.id, title: productTitle(c) }]))
  } catch {
    return new Map()
  }
}

const VERDICT_TONE: Record<Verdict, string> = {
  verified: 'text-accent-400',
  partial: 'text-ink',
  incompatible: 'text-danger',
  unknown: 'text-ink-faint',
}

/* A tick only for `verified`; `unknown` carries none (brief §5.2). */
const VERDICT_ICON: Record<Verdict, string | null> = {
  verified: 'M5 12.5l4.5 4.5L19 7.5',
  partial: 'M5 12h14',
  incompatible: 'M7 7l10 10M17 7L7 17',
  unknown: null,
}

function VerdictMark({ verdict, label }: { verdict: Verdict; label: string }) {
  const icon = VERDICT_ICON[verdict]
  return (
    <span className={`inline-flex items-center gap-1.5 text-body-sm font-semibold ${VERDICT_TONE[verdict]}`}>
      {icon ? (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d={icon} />
        </svg>
      ) : null}
      {label}
    </span>
  )
}

type LineKey = 'missing' | 'range' | 'firmware' | 'substitute' | 'unverified'

/** One line per kind of problem; a line that reads the same for stills and movies is said once. */
function detailLines(assessments: readonly Assessment[]) {
  const lines = new Map<string, { key: LineKey; modes: ShootingMode[]; values: Record<string, string> }>()
  const add = (mode: ShootingMode, key: LineKey, values: Record<string, string>) => {
    const id = `${key}|${JSON.stringify(values)}`
    const line = lines.get(id)
    if (line) line.modes.push(mode)
    else lines.set(id, { key, modes: [mode], values })
  }
  for (const a of assessments) {
    const by = (pred: (o: Outcome) => boolean) =>
      a.outcomes.filter(pred).map((o) => capabilityLabel(o.requirement.capability))
    const missing = by((o) => o.kind === 'unsupported' && (o.reason === 'stated' || o.reason === 'absent'))
    const range = by((o) => o.kind === 'unsupported' && (o.reason === 'outOfRange' || o.reason === 'offStep'))
    const unverified = by((o) => o.kind === 'unknown')
    if (missing.length) add(a.mode, 'missing', { settings: missing.join(', ') })
    if (range.length) add(a.mode, 'range', { settings: range.join(', ') })
    for (const o of a.outcomes) {
      if (o.kind === 'substituted') {
        add(a.mode, 'substitute', {
          setting: capabilityLabel(o.requirement.capability),
          alternative: capabilityLabel(o.alternative),
        })
      }
      if ((o.kind === 'supported' && o.firmware) || (o.kind === 'unsupported' && o.reason === 'firmware')) {
        const version = o.kind === 'supported' ? o.firmware! : (o.evidence.find((c) => c.firmware)?.firmware ?? '')
        add(a.mode, 'firmware', { settings: capabilityLabel(o.requirement.capability), version })
      }
    }
    if (unverified.length) add(a.mode, 'unverified', { settings: unverified.join(', ') })
  }
  return [...lines.values()]
}

/** On a recipe page: every evidenced body, stills and movies, with what stands in the way. */
export async function RecipeCompatibility({ recipe }: { recipe: RecipeSettings }) {
  if (EVIDENCED_CAMERAS.length === 0) return null
  const [t, products] = await Promise.all([getTranslations('compat'), productsByModel()])

  const rows = EVIDENCED_CAMERAS.map((camera) => ({
    camera,
    product: products.get(camera),
    assessments: SHOOTING_MODES.map((mode) => assessRecipe(recipe, camera, mode)),
  }))

  return (
    <section aria-labelledby="compat" className="surface flex flex-col gap-4 p-5">
      <h2 id="compat" className="label">
        {t('title')}
      </h2>
      <div>
        {/* Column heads from `sm` up; on a phone each row names its own modes. */}
        <div className="hidden grid-cols-[minmax(0,1fr)_8.5rem_8.5rem] gap-x-3 px-3 pb-2 sm:grid" aria-hidden="true">
          <span className="meta">{t('body')}</span>
          <span className="meta">{t('photo')}</span>
          <span className="meta">{t('video')}</span>
        </div>
        <ul className="flex flex-col gap-1.5">
          {rows.map(({ camera, product, assessments }) => (
            <li key={camera} className="row-tint rounded-sm px-3 py-2.5">
              <div className="flex flex-col gap-1 sm:grid sm:grid-cols-[minmax(0,1fr)_8.5rem_8.5rem] sm:items-center sm:gap-x-3">
                {product ? (
                  <Link
                    href={`/cameras/${product.id}#colour-settings`}
                    className="truncate text-body-sm font-semibold text-ink transition-colors hover:text-accent-400"
                  >
                    {product.title}
                  </Link>
                ) : (
                  <span className="truncate text-body-sm font-semibold text-ink">{camera}</span>
                )}
                <div className="flex flex-wrap gap-x-5 gap-y-1 sm:contents">
                  {assessments.map((a) => (
                    <span key={a.mode} className="inline-flex items-baseline gap-1.5">
                      <span className="meta sm:sr-only">{t(a.mode)}</span>
                      <VerdictMark verdict={a.verdict} label={t(`verdict.${a.verdict}`)} />
                    </span>
                  ))}
                </div>
              </div>
              {detailLines(assessments).map((line) => (
                <p key={`${line.key}${line.modes.join()}${JSON.stringify(line.values)}`} className="meta mt-1">
                  {t(`line.${line.key}`, { ...line.values, modes: line.modes.map((m) => t(m)).join(', ') })}
                </p>
              ))}
            </li>
          ))}
        </ul>
      </div>
      <p className="meta">{t('notChecked')}</p>
      <p className="meta">{t('disclaimer')}</p>
    </section>
  )
}

function asSourceRefs(camera: string): SourceRef[] {
  return sourcesOf(camera).map((s) => ({
    url: s.url,
    title: `${camera} Help Guide — ${s.topic}`,
    publisher: 'Sony Help Guide',
    checkedAt: s.checkedAt,
  }))
}

const GROUP_TITLE = { pp: 'Picture Profile', cl: 'Creative Look', wb: 'White Balance' } as const

/** A list of menu names, none broken across lines: `S-Log3` wrapped after its hyphen. */
function Names({ labels }: { labels: readonly string[] }) {
  return labels.map((label, i) => (
    <Fragment key={label}>
      <span className="whitespace-nowrap">{label}</span>
      {i < labels.length - 1 ? ', ' : null}
    </Fragment>
  ))
}

/** On a camera page: what its colour menus hold, and the recipes that fit it. */
export async function CameraColourSettings({ sku, locale }: { sku: string; locale: Locale }) {
  const camera = modelCode(sku)
  const byKey = capabilitiesOf(camera)
  if (byKey.size === 0) return null

  const [t, recipes] = await Promise.all([
    getTranslations('compat'),
    listRecipes(locale).then(
      (r) => r,
      () => null,
    ),
  ])
  const groups = summariseFeatures(byKey)
  const fits = recipes?.map((r) => ({
    recipe: r,
    photo: assessRecipe(r, camera, 'photo').verdict,
    video: assessRecipe(r, camera, 'video').verdict,
  }))
  const forStills = fits?.filter((f) => f.photo === 'verified') ?? []

  return (
    <section id="colour-settings" aria-labelledby="h-colour-settings" className="surface flex scroll-mt-24 flex-col gap-5 p-5">
      <h2 id="h-colour-settings" className="text-title-3 font-semibold tracking-[-0.02em] text-ink">
        {t('featuresTitle')}
      </h2>

      <div className="grid gap-5 lg:grid-cols-3">
        {groups.map((g) => (
          <div key={g.group} className="flex flex-col gap-2">
            <h3 className="label">{GROUP_TITLE[g.group]}</h3>
            {g.rows.map(({ row, labels }) => (
              <p key={row} className="text-body-sm leading-[1.5] text-ink">
                <span className="meta block">{t(`rows.${row}`)}</span>
                <Names labels={labels} />
              </p>
            ))}
            {g.stillsOnly.length > 0 ? (
              <p className="text-body-sm leading-[1.5] text-ink">
                <span className="meta block">{t('rows.stillsOnly')}</span>
                <Names labels={g.stillsOnly} />
              </p>
            ) : null}
            {g.notOnBody.length > 0 ? (
              <p className="text-body-sm leading-[1.5] text-ink-muted">
                <span className="meta block">{t('rows.notOnBody')}</span>
                <Names labels={g.notOnBody} />
              </p>
            ) : null}
            {g.group === 'wb' ? <p className="meta">{t('noWbNumbers')}</p> : null}
          </div>
        ))}
      </div>

      <hr className="seam" />

      <div className="flex flex-col gap-2">
        <h3 className="label">{t('verifiedRecipes')}</h3>
        {fits ? (
          <>
            <p className="meta">
              {t('verifiedCount', {
                photo: forStills.length,
                video: fits.filter((f) => f.video === 'verified').length,
              })}
            </p>
            {forStills.length > 0 ? (
              <ul className="flex flex-wrap gap-2">
                {forStills.map(({ recipe }) => (
                  <li key={recipe.id}>
                    <Link href={`/recipe/${recipe.slug}`} className="chip chip-action">
                      {recipe.name.split(': ').slice(1).join(': ') || recipe.name}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        ) : (
          <p className="meta">{t('recipesUnavailable')}</p>
        )}
      </div>

      <SourceList sources={asSourceRefs(camera)} headingLevel={3} lang="en" />
      <p className="meta">{t('disclaimer')}</p>
    </section>
  )
}

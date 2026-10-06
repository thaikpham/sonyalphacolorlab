import { Fragment } from 'react'
import { getTranslations } from 'next-intl/server'
import { modelCode } from '@/lib/cameras/aliases'
import { summariseFeatures } from '@/lib/cameras/capabilities/features'
import { capabilitiesOf, sourcesOf } from '@/lib/cameras/capabilities/index'
import type { SourceRef } from '@/lib/lab/types'
import { SourceList } from '@/components/content/source-list'

/**
 * What a body's colour menus hold, from `src/lib/cameras/capabilities`, which
 * counts only claims a live check of Sony's Help Guide confirmed (ADR 0005).
 * Renders nothing for a body without evidence.
 */

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

export async function CameraColourSettings({ sku }: { sku: string }) {
  const camera = modelCode(sku)
  const byKey = capabilitiesOf(camera)
  if (byKey.size === 0) return null

  const t = await getTranslations('colourSettings')
  const groups = summariseFeatures(byKey)

  return (
    <section id="colour-settings" aria-labelledby="h-colour-settings" className="surface flex scroll-mt-24 flex-col gap-5 p-5">
      <h2 id="h-colour-settings" className="text-title-3 font-semibold tracking-[-0.02em] text-ink">
        {t('title')}
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

      <SourceList sources={asSourceRefs(camera)} headingLevel={3} lang="en" />
    </section>
  )
}

import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import type { LinkTarget } from '@/lib/content/relations'
import type { ContentRefKind } from '@/lib/lab/types'

/**
 * A related-content list, grouped by kind.
 *
 * Text links only — a name and one short line — on every surface, the paper
 * blog included. A recipe's photograph or accent swatch on a light ground is
 * exactly what the paper room was allowed on condition of not showing
 * (ADR 0001), and a dark recipe page gains nothing from a second set of
 * thumbnails under its own gallery.
 *
 * Renders nothing when there is nothing to show — an empty "Related" heading
 * reads as a page that failed to load — unless a source failed, in which case
 * it says so rather than passing the gap off as "nothing related".
 */

const ORDER: readonly ContentRefKind[] = ['knowledge', 'article', 'recipe', 'product']

export async function RelatedLinks({
  links,
  unavailable = false,
  heading,
  headingLevel = 2,
  lang,
}: {
  links: readonly LinkTarget[]
  unavailable?: boolean
  /** Defaults to "Related". */
  heading?: string
  headingLevel?: 2 | 3
  /** Set when the titles are authored Vietnamese inside a page of another locale. */
  lang?: string
}) {
  if (links.length === 0 && !unavailable) return null
  const t = await getTranslations('learn')
  const H = headingLevel === 2 ? 'h2' : 'h3'
  const groups = ORDER.map((kind) => ({ kind, items: links.filter((l) => l.kind === kind) })).filter(
    (g) => g.items.length > 0,
  )

  return (
    <section aria-label={heading ?? t('related')} className="flex flex-col gap-4">
      <H className="label">{heading ?? t('related')}</H>
      {groups.map((g) => (
        <div key={g.kind}>
          <p className="meta">{t(`relatedKinds.${g.kind}`)}</p>
          <ul className="mt-1">
            {g.items.map((l) => (
              <li key={`${l.kind}:${l.id}`}>
                <hr className="seam" />
                <Link
                  href={l.href}
                  className="group flex min-h-[var(--layout-touch-target)] flex-col justify-center gap-0.5 rounded-sm px-2 py-2.5 transition-colors hover:bg-glass"
                >
                  <span
                    lang={l.kind === 'article' || l.kind === 'knowledge' ? lang : undefined}
                    className="text-body-sm font-semibold leading-[1.35] text-ink transition-colors group-hover:text-accent-400"
                  >
                    {l.title}
                  </span>
                  {l.subtitle ? <span className="meta">{l.subtitle}</span> : null}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {unavailable ? <p className="meta">{t('relatedUnavailable')}</p> : null}
    </section>
  )
}

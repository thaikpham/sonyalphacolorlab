import { getLocale, getTranslations } from 'next-intl/server'
import type { SourceRef } from '@/lib/lab/types'

/**
 * Where a page's technical claims were checked, kept compact.
 *
 * Each source is the page title as a link, then publisher, section and scope,
 * then the day it was read. A source without a date still renders — a blog
 * article may cite one — but a knowledge page cannot be published without the
 * date (`validateKnowledgeShape`), because an undated reference to firmware
 * documentation says nothing about which firmware.
 *
 * The links leave the site: `noopener noreferrer`, so the destination gets
 * neither a handle on this window nor the article's URL.
 */

/** `2026-10-05` in the reader's locale, as a calendar day — never shifted by a time zone. */
export function formatIsoDay(day: string, locale: string): string {
  const date = new Date(`${day}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return day
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

export async function SourceList({
  sources,
  lang,
  headingLevel = 2,
}: {
  sources: readonly SourceRef[]
  lang?: string
  headingLevel?: 2 | 3
}) {
  if (sources.length === 0) return null
  const [t, locale] = await Promise.all([getTranslations('learn'), getLocale()])
  const H = headingLevel === 2 ? 'h2' : 'h3'

  return (
    <section aria-label={t('sources')}>
      <H className="label">{t('sources')}</H>
      <ol className="mt-2 flex flex-col gap-2">
        {sources.map((s) => {
          const facts = [s.publisher, s.section, s.scope].filter(Boolean).join(' · ')
          return (
            <li key={`${s.url}#${s.section ?? ''}`} className="text-body-sm leading-[1.5]">
              <a
                href={s.url}
                rel="noopener noreferrer"
                target="_blank"
                lang={lang}
                className="font-semibold text-accent-400 underline decoration-accent-400/40 underline-offset-2 transition-colors hover:decoration-accent-400 [overflow-wrap:anywhere]"
              >
                {s.title}
              </a>
              {facts || s.checkedAt ? (
                <span className="meta block">
                  <span lang={lang}>{facts}</span>
                  {facts && s.checkedAt ? ' · ' : null}
                  {s.checkedAt ? t('checkedOn', { date: formatIsoDay(s.checkedAt, locale) }) : null}
                </span>
              ) : null}
            </li>
          )
        })}
      </ol>
    </section>
  )
}

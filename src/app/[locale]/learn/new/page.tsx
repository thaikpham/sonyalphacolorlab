import type { Metadata, Viewport } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import type { Locale } from '@/i18n/routing'
import { EditRoute } from '../../_edit/edit-route'

/* The paper room's ground for the browser chrome, as on `/blog/[id]`. */
export const viewport: Viewport = { themeColor: '#F9F8F5', colorScheme: 'light' }

/* An administrator's screen: nothing here may be prerendered or cached. */
export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'adminUi' })
  return { title: t('metaArticles'), robots: { index: false, follow: false } }
}

export default async function NewKnowledgePage({
  params,
}: {
  params: Promise<{ locale: Locale }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  return <EditRoute kind="knowledge" id={null} />
}

import { getTranslations } from 'next-intl/server';
import { SiteHeader } from '@/components/site-header';
import { Link } from '@/i18n/navigation';

export default async function NotFound() {
  const t = await getTranslations('notFound');
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-[86rem] flex-1 flex-col items-start justify-center inset-safe py-32">
        {/* An ASCII mark rather than a big "404" — it belongs to the same
            decorative language as the rest of the site. */}
        {/* font-mono, not `tabular`: that class resolves to --font-sans, and
            box-drawing glyphs only line up in a fixed pitch. */}
        <pre aria-hidden className="font-mono text-ink-faint text-sm leading-tight">
          {'  ┌─────┐\n  │  ?  │\n  └─────┘'}
        </pre>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="mt-3 max-w-md text-ink-muted">{t('body')}</p>
        <Link
          href="/"
          className="eyebrow glass-flat mt-8 rounded-full px-4 py-2 hover:!text-ink transition-colors"
        >
          {t('action')}
        </Link>
      </main>
    </>
  );
}

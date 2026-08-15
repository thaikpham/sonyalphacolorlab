import { getTranslations } from 'next-intl/server';
import { SiteHeader } from '@/components/site-header';
import { Link } from '@/i18n/navigation';

export default async function NotFound() {
  const t = await getTranslations('notFound');
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-[86rem] flex-1 flex-col items-start justify-center inset-safe py-32">
        {/* A quiet mark rather than a big "404". It was box-drawing characters
            in a mono face; the glyphs only line up at a fixed pitch, so the
            drawing left with the second family. The same badge as the error
            page, in ink rather than a signal — a missing page classifies
            nothing. */}
        <div
          aria-hidden
          className="surface flex size-16 items-center justify-center text-title-2 font-extrabold text-ink-faint"
        >
          ?
        </div>
        <h1 className="mt-6 text-title-1 font-extrabold tracking-[-0.02em]">{t('title')}</h1>
        <p className="mt-3 max-w-md text-body text-ink-muted">{t('body')}</p>
        {/* The copy promises the catalogue ("Browse all recipes"), so it has to
            land there. `/` is the ecosystem launcher and would answer a missing
            recipe with four app tiles. */}
        <Link href="/colorlab" className="btn-glass mt-8 inline-flex items-center">
          {t('action')}
        </Link>
      </main>
    </>
  );
}

import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { LauncherGrid } from '@/components/launcher-grid';
import type { Locale } from '@/i18n/routing';
import { ECOSYSTEM_APPS } from '@/lib/ecosystem';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'launcher' });
  return { title: t('title'), description: t('subtitle') };
}

/**
 * The launcher — the landing page for the whole ecosystem.
 *
 * Deliberately without the site header and footer. Every other route carries
 * that chrome because it is a place inside one app; this is the doorway to four
 * of them, and a header advertising one of the four would be picking a winner
 * before the reader has chosen. The tiles are the only navigation.
 *
 * A Server Component, and so is `EcosystemApp`, so the page itself contributes
 * no client JavaScript — only the layout's `AuthProvider` does. The entrance
 * stagger and hover glow are CSS (`app-enter-*`, `app-glow` in the VFX
 * stylesheet), so none of it needs hydration to move.
 *
 * The recipe catalogue that used to live here is at `/colorlab`.
 */
export default async function LauncherPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('launcher');

  return (
    /* `100dvh`, never `100vh` — mobile browser chrome makes `vh` overshoot and
       would push the bottom row under the address bar. `overflow-y-auto` so a
       short landscape phone can still reach the fourth tile rather than having
       it clipped. */
    <main className="relative flex min-h-[100dvh] w-full flex-col items-center justify-center overflow-y-auto inset-safe px-6 py-14 sm:px-10">
      {/* The tiles are the page. No visible title, no tagline, no rule — the
          four icons say what this is faster than a heading does.
          `sr-only`, not deleted: a page with four `h2`s and no `h1` fails axe,
          and this is the only text a screen reader or a search result has to go
          on. Same device the recipe grid uses for its own heading. */}
      <h1 className="sr-only">{t('title')}</h1>

      {/* Two by two at every size. Four tiles read as a grid, not a list, and a
          single column on a phone would put the last one two screens down. */}
      <LauncherGrid size="lg" />

    </main>
  );
}

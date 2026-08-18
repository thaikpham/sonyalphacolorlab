import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { LauncherGrid } from '@/components/launcher-grid';
import type { Locale } from '@/i18n/routing';

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
 * A Server Component with no client boundary of its own — `LauncherGrid` owns
 * the Sony Wiki sub-view, and tile motion is CSS-only (`.launcher-*` in
 * globals.css). The stage is flat `--color-void`: no artwork, no canvas, no
 * frame loop, so the spectral glow behind the tiles is the only thing moving.
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
    <main className="launcher-stage flex min-h-[100dvh] w-full flex-col items-center justify-center overflow-y-auto inset-safe py-12">
      {/* The tiles are the page. No visible title, no tagline and no divider —
          the four icons say what this is faster than a heading does.
          `sr-only`, not deleted: a page with four `h2`s and no `h1` fails axe,
          and this is the only text a screen reader or a search result has to go
          on. Same device the recipe grid uses for its own heading. */}
      <h1 className="sr-only">{t('title')}</h1>

      {/* Two columns on a phone, three on a tablet, one row on desktop — the
          grid and its glow are LauncherGrid's, the one sanctioned exception in
          the system. The page's only job is to centre it and stay out of the
          way: no panel behind it, because a translucent film under a spectral
          halo turns the exception into a card treatment. */}
      <LauncherGrid size="lg" />
    </main>
  );
}

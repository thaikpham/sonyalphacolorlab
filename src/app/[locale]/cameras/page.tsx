import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getSonyCameras } from '@/lib/cameras/data';
import { toCameraCard } from '@/lib/cameras/types';
import { CameraWikiView } from '@/components/camera-wiki-view';
import { SiteHeader } from '@/components/site-header';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  /* Not `locale === 'vi' ? … : …`. That ternary hides both strings from the
     parity test, and the failure is one-directional and silent: a Vietnamese
     literal renders untranslated to English readers and nothing errors. The
     audio route next door already did this correctly. */
  const t = await getTranslations({ locale, namespace: 'cameras' });
  return {
    title: t('camerasTitle'),
    description: t('camerasSubtitle'),
  };
}

export default async function CamerasPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'cameras' });

  /* Projected to cards before crossing into the Client Component: everything
     passed across that boundary is serialised into the RSC payload and the
     prerendered HTML, and the grid reads none of the spec fields. */
  const initialCameras = (await getSonyCameras()).map(toCameraCard);

  return (
    <>
      <SiteHeader />

      <main className="flex-1 w-full max-w-[160rem] mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12 py-8">
        <CameraWikiView initialCameras={initialCameras} />
      </main>

      {/* A divider that is light rather than a line — the one place this page
          separates two blocks. */}
      <div className="w-full max-w-[160rem] mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12">
        <hr className="seam" />
      </div>

      <footer className="meta w-full py-8 text-center">
        {t('footerCameraWiki')}
      </footer>
    </>
  );
}

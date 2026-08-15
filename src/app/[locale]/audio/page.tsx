import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getSonyAudio } from '@/lib/audio/data';
import { toCameraCard } from '@/lib/cameras/types';
import { CameraWikiView } from '@/components/camera-wiki-view';
import { SiteHeader } from '@/components/site-header';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'cameras' });
  return { title: t('audioTitle'), description: t('audioSubtitle') };
}

export default async function AudioPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'cameras' });

  /* Projected to cards before crossing into the Client Component — the grid
     reads no spec field, and shipping the blocks would put the whole
     comparison table in the RSC payload twice. */
  const initialProducts = (await getSonyAudio()).map(toCameraCard);

  return (
    <>
      <SiteHeader />

      <main className="flex-1 w-full max-w-[160rem] mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12 py-8">
        {/* Same grid as the camera catalogue, pointed at this route: the sort,
            search and filter controls all navigate through `basePath`. */}
        <CameraWikiView initialCameras={initialProducts} basePath="/audio" />
      </main>

      {/* A divider that is light rather than a line — the one place this page
          separates two blocks. */}
      <div className="w-full max-w-[160rem] mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12">
        <hr className="seam" />
      </div>

      <footer className="meta w-full py-8 text-center">
        {t('footerAudioRoute')}
      </footer>
    </>
  );
}

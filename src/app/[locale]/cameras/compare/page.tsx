import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getSonyCameras } from '@/lib/cameras/data';
import { getSonyAudio } from '@/lib/audio/data';
import { CameraCompareView } from '@/components/camera-compare-view';
import { SiteHeader } from '@/components/site-header';
import type { SonyCamera } from '@/lib/cameras/types';

/**
 * `highlights` is bilingual sales-talk copy the compare grid never reads —
 * `compare-grouping.ts` builds its rows from `specs`, `features` and the
 * identity fields alone. Sent whole, every camera's highlights in both
 * languages ride into the RSC payload and the client bundle for nothing,
 * which is the same shape of waste `CameraCard` exists to cut for the browse
 * grid. A mapper, not just a narrower prop type, so the omission survives
 * even though `highlights` is optional on `SonyCamera` and a bare type
 * annotation would not have caught a `{ ...camera }` spread putting it back.
 */
const stripHighlights = ({ highlights: _highlights, ...camera }: SonyCamera): Omit<SonyCamera, 'highlights'> =>
  camera;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'cameras' });
  return {
    title: t('compareMetaTitle'),
    description: t('compareMetaDescription'),
  };
}

export default async function CameraComparePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ ids?: string }>;
}) {
  const { locale } = await params;
  const { ids } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'cameras' });

  /* Both catalogues. This is the only compare surface, and `?ids=` can name a
     body and a headset in the same list — resolving against cameras alone
     dropped every audio id silently, leaving a compare page with fewer columns
     than the reader ticked. */
  const initialCameras = [...(await getSonyCameras()), ...(await getSonyAudio())].map(stripHighlights);
  const selectedIds = ids ? ids.split(',').filter(Boolean) : [];

  return (
    <>
      <SiteHeader />

      <main className="flex-1 w-full max-w-[160rem] mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12 py-8">
        <CameraCompareView initialCameras={initialCameras} selectedIds={selectedIds} />
      </main>

      {/* Light, not a line — the same seam the two catalogue routes use. */}
      <div className="w-full max-w-[160rem] mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12">
        <hr className="seam" />
      </div>

      <footer className="meta w-full py-8 text-center">{t('footerCameraWiki')}</footer>
    </>
  );
}

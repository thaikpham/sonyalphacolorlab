import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { getSonyCameras } from '@/lib/cameras/data';
import { CameraWikiView } from '@/components/camera-wiki-view';
import { SiteHeader } from '@/components/site-header';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const isVi = locale === 'vi';
  return {
    title: isVi ? 'Bảng Tra Cứu Máy Ảnh Sony' : 'Sony Camera Catalog Wiki',
    description: isVi
      ? 'Tra cứu và so sánh thông số kỹ thuật, giá niêm yết chính hãng hơn 35+ dòng máy ảnh Sony Alpha, Cinema Line và Vlog.'
      : 'Explore technical specs, official prices, and features of 35+ Sony Alpha and Cinema Line cameras.',
  };
}

export default async function CamerasPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const initialCameras = await getSonyCameras();

  return (
    <>
      <SiteHeader />

      <main className="flex-1 w-full max-w-[86rem] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <CameraWikiView initialCameras={initialCameras} />
      </main>

      <footer className="w-full py-8 text-center text-xs text-white/40 border-t border-white/10 font-mono">
        Alpha ColorLab · Sony Camera Catalog & Spec Wiki
      </footer>
    </>
  );
}

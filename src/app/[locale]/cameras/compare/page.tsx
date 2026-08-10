import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { getSonyCameras } from '@/lib/cameras/data';
import { CameraCompareView } from '@/components/camera-compare-view';
import { SiteHeader } from '@/components/site-header';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const isVi = locale === 'vi';
  return {
    title: isVi ? 'So Sánh Chi Tiết Sản Phẩm Sony' : 'Compare Sony Alpha Products',
    description: isVi
      ? 'Chuyên trang so sánh thông số kỹ thuật chi tiết và tư vấn chọn máy bởi Sony Specialist AI.'
      : 'Detailed side-by-side spec comparison and AI Sony Specialist advice.',
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

  const initialCameras = await getSonyCameras();
  const selectedIds = ids ? ids.split(',').filter(Boolean) : [];

  return (
    <>
      <SiteHeader />

      <main className="flex-1 w-full max-w-[160rem] mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12 py-8">
        <CameraCompareView initialCameras={initialCameras} selectedIds={selectedIds} />
      </main>

      <footer className="w-full py-8 text-center text-xs text-white/40 border-t border-white/10 font-mono">
        Alpha ColorLab · Sony Camera Catalog & Spec Wiki
      </footer>
    </>
  );
}

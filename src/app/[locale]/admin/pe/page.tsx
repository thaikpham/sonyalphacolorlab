import type { Metadata } from 'next';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { NextIntlClientProvider } from 'next-intl';
import { getSonyCameras } from '@/lib/cameras/data';
import { getSonyAudio } from '@/lib/audio/data';
import { SiteHeader } from '@/components/site-header';
import { AdminEditor } from '@/components/admin/admin-editor';

export const metadata: Metadata = {
  title: 'PE Product Admin — Alpha ColorLab',
  robots: { index: false, follow: false },
};

export default async function AdminPePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const products = [...(await getSonyCameras()), ...(await getSonyAudio())];
  const messages = await getMessages();

  const clientMessages = {
    admin: messages.admin,
    auth: messages.auth,
    cameras: messages.cameras,
    language: messages.language,
    nav: messages.nav,
    search: messages.search,
  };

  return (
    <NextIntlClientProvider messages={clientMessages}>
      <div className="min-h-screen flex flex-col bg-[#0b0d12] text-white font-sans">
        <SiteHeader />
        <AdminEditor products={products} initialTab="pe" />
      </div>
    </NextIntlClientProvider>
  );
}

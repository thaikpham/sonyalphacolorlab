import type { Metadata } from 'next';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { NextIntlClientProvider } from 'next-intl';
import { getSonyCameras } from '@/lib/cameras/data';
import { getSonyAudio } from '@/lib/audio/data';
import { SiteHeader } from '@/components/site-header';
import { AdminEditor } from '@/components/admin/admin-editor';

/**
 * The admin surface.
 *
 * Deliberately `noindex`, and deliberately *not* gated here. The gate is
 * `requireAdmin()` on every write route; this page renders the catalogue, which
 * is already public, and the editor asks the server who it is before showing
 * controls. Gating the render instead would look safer and be worth nothing —
 * a page is not an authorisation boundary, and the data it lists is on
 * /cameras anyway.
 */

export const metadata: Metadata = {
  title: 'Product Admin — Alpha ColorLab',
  robots: { index: false, follow: false },
};

export default async function AdminPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const products = [...(await getSonyCameras()), ...(await getSonyAudio())];
  const messages = await getMessages();

  /* Explicit namespaces, not the whole catalogue: the default ships every
     string to the browser, which is what once put the homepage headline on a
     recipe page. `admin` is only read here. */
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
        <AdminEditor products={products} />
      </div>
    </NextIntlClientProvider>
  );
}

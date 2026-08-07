import { setRequestLocale } from 'next-intl/server';
import { SiteHeader } from '@/components/site-header';
import type { Locale } from '@/i18n/routing';

export default async function CheeseBoothPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // The actual URL of the Vite app
  const appUrl = 'https://cheese-booth.vercel.app/';

  return (
    <div className="flex flex-col h-[100dvh] w-full overflow-hidden">
      <div className="shrink-0 z-50">
        <SiteHeader />
      </div>
      <main className="flex-1 w-full relative bg-black">
        <iframe
          src={appUrl}
          className="absolute inset-0 w-full h-full border-none"
          title="CheeseBooth"
          allow="camera; microphone; display-capture; fullscreen"
        />
      </main>
    </div>
  );
}

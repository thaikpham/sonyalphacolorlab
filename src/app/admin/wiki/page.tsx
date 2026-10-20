import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ADMIN_LOCALE } from '@/lib/admin/locale';
import { getSonyCameras } from '@/lib/cameras/data';
import { getSonyAudio } from '@/lib/audio/data';
import { AdminEditor } from '@/components/admin/admin-editor';

/**
 * The Wiki product editor.
 *
 * This replaces four routes — `/admin/di`, `/admin/pe`, `/di/admin` and
 * `/pe/admin` — that differed only in the `initialTab` they passed. The
 * division is a search param now, and the editor already refuses a division the
 * caller's role does not cover: `canManageCategory()` is enforced server-side
 * in `products/route.ts`, and the tab is disabled client-side to match.
 *
 * Reading the catalogue here is not a leak. It is what `/cameras` serves to
 * anyone; the gate is on the write routes, where it belongs.
 */

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations({ locale: ADMIN_LOCALE, namespace: 'adminUi' });
  return { title: t('metaProducts') };
}

export default async function AdminWikiPage({
  searchParams,
}: {
  searchParams: Promise<{ division?: string }>;
}) {
  const { division } = await searchParams;
  const initialTab = division === 'pe' ? 'pe' : division === 'di' ? 'di' : undefined;
  const products = [...(await getSonyCameras()), ...(await getSonyAudio())];

  return <AdminEditor products={products} initialTab={initialTab} />;
}

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ADMIN_LOCALE } from '@/lib/admin/locale';
import { ArticleAdmin } from '@/components/lab/admin/article-admin';

/**
 * The Alpha Tech Blogs article editor.
 *
 * Moved from `/[locale]/blog/admin`, where it had to be a static segment
 * matched before `/blog/[id]` and needed `RESERVED_IDS` in `lib/lab/parse.ts`
 * to stop an article being saved at a URL it would shadow. That collision is
 * gone here — `/admin/blog` cannot shadow an article id — but `RESERVED_IDS`
 * stays: `admin` is still a URL nobody should be able to take.
 */

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations({ locale: ADMIN_LOCALE, namespace: 'adminUi' });
  return { title: t('metaArticles') };
}

export default function AdminBlogPage() {
  return <ArticleAdmin />;
}

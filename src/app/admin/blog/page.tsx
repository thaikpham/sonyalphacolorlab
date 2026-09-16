import type { Metadata } from 'next';
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

export const metadata: Metadata = {
  title: 'Bài viết',
};

export default function AdminBlogPage() {
  return <ArticleAdmin />;
}

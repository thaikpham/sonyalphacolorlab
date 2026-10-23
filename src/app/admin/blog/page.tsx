import { redirect } from 'next/navigation'

/**
 * Moved to the pages themselves (2026-10-22): an article is edited at
 * /blog/<id>/edit from its own Sửa link, and a new page or a draft is reached
 * from the row an administrator sees on /blog and /learn.
 *
 * Dynamic, so this is a real 307 rather than a static meta refresh — the
 * reasoning on `[locale]/blog/admin/page.tsx`.
 */
export const dynamic = 'force-dynamic'

export default function AdminBlogPage() {
  redirect('/blog')
}

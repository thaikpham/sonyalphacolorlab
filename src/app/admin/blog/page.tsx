import { redirect } from 'next/navigation'

/**
 * Moved to the pages themselves (2026-10-22): an article is edited at
 * /blog/<id>/edit from its own Sửa link, and a new page or a draft is reached
 * from the row an administrator sees on /blog and /learn.
 *
 * Dynamic, so Next does not prerender it as a 200 with a one-second `<meta
 * http-equiv="refresh">`. It is still not an HTTP 307: `admin/layout.tsx`
 * renders its `<html>`, the shell and the gate's "checking" screen first, so
 * the response has started by the time this throws, and the redirect travels
 * in the RSC stream (`NEXT_REDIRECT;replace;/blog;307`) for the client router
 * to perform — the same shape as `/admin/di`. A `curl` sees `200` and the
 * admin chrome; a browser lands on `/blog`. The locale variant,
 * `[locale]/blog/admin/page.tsx`, has no layout streaming ahead of it and does
 * answer `307`.
 */
export const dynamic = 'force-dynamic'

export default function AdminBlogPage() {
  redirect('/blog')
}

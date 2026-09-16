import { redirect } from 'next/navigation';

/**
 * Moved to `/admin/wiki?division=di`.
 *
 * One of two spellings of the same screen — `/admin/di` and `/di/admin` both existed and both rendered the same editor.
 *
 * A page that redirects rather than an entry in `next.config.ts`: middleware
 * runs before config redirects, so a config rule here would race next-intl's
 * locale rewrite on the very paths this app prefixes. A redirect inside the
 * segment runs after the locale is resolved and cannot be raced.
 */
/* Dynamic, so this answers with a real 307.
 *
 * `[locale]/layout.tsx` has `generateStaticParams`, so without this the page
 * is prerendered — and Next expresses a redirect in a STATIC page as a 200
 * carrying `<meta http-equiv="refresh" content="1;url=...">`. That works, one
 * second later, and it is not what a bookmark or a `curl` follows. A page
 * whose entire body is a redirect has nothing to gain from being static. */
export const dynamic = 'force-dynamic';

export default function MovedPage() {
  redirect('/admin/wiki?division=di');
}

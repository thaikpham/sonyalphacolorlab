import { redirect } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';

/**
 * Moved to `/blog`: an article is edited on its own page now, not in a
 * separate admin screen, so there is nothing left at `/admin/blog` either —
 * this redirects straight to the feed, in one hop.
 *
 * A page that redirects rather than an entry in `next.config.ts`: middleware
 * runs before config redirects, so a config rule here would race next-intl's
 * locale rewrite on the very paths this app prefixes. A redirect inside the
 * segment runs after the locale is resolved and cannot be raced.
 *
 * The locale-aware `redirect`, given the request's locale. `next/navigation`'s
 * sent every reader to the bare `/blog`, which under `as-needed` prefixing is
 * the English feed — a Vietnamese reader following an old bookmark landed in
 * the wrong language.
 */
/* Dynamic, so this answers with a real 307.
 *
 * `[locale]/layout.tsx` has `generateStaticParams`, so without this the page
 * is prerendered — and Next expresses a redirect in a STATIC page as a 200
 * carrying `<meta http-equiv="refresh" content="1;url=...">`. That works, one
 * second later, and it is not what a bookmark or a `curl` follows. A page
 * whose entire body is a redirect has nothing to gain from being static. */
export const dynamic = 'force-dynamic';

export default async function MovedPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  redirect({ href: '/blog', locale });
}

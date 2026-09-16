import { redirect } from 'next/navigation';

/**
 * Moved to `/admin/wiki?division=pe`.
 *
 * The old English spelling of this screen. `/admin` is excluded from the
 * next-intl matcher now (see `src/proxy.ts`), so `/admin/pe` no longer reaches
 * `[locale]/admin/pe` — it resolves here instead, and would 404 without this.
 * Its Vietnamese twin `/vi/admin/pe` is handled inside the locale segment.
 */
export default function MovedPage() {
  redirect('/admin/wiki?division=pe');
}

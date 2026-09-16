import { redirect } from 'next/navigation';

/**
 * Moved to `/admin/wiki?division=di`.
 *
 * The old English spelling of this screen. `/admin` is excluded from the
 * next-intl matcher now (see `src/proxy.ts`), so `/admin/di` no longer reaches
 * `[locale]/admin/di` — it resolves here instead, and would 404 without this.
 * Its Vietnamese twin `/vi/admin/di` is handled inside the locale segment.
 */
export default function MovedPage() {
  redirect('/admin/wiki?division=di');
}

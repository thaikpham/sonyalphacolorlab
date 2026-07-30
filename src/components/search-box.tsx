import { getTranslations } from 'next-intl/server';
import { routing } from '@/i18n/routing';

/**
 * Search.
 *
 * A plain GET form, not a client component: it submits to the same URL the
 * filter links already use, so search works with JavaScript disabled and a
 * searched view stays shareable and indexable — the same reasoning as the
 * filter bar.
 *
 * Active filters ride along as hidden inputs. Without them, searching would
 * silently clear whatever the reader had already narrowed down.
 */
export async function SearchBox({
  active,
  q,
  locale,
}: {
  active: { format?: string; look?: string; tag?: string };
  q?: string;
  locale: string;
}) {
  const t = await getTranslations('search');

  // The action must carry the locale prefix. A hardcoded "/" sends a Vietnamese
  // reader who arrived on a shared /vi link — and so has no locale cookie yet —
  // straight into the English site the moment they search.
  const action = locale === routing.defaultLocale ? '/' : `/${locale}`;

  return (
    <form role="search" action={action} method="get" className="flex items-center gap-2">
      {Object.entries(active).map(([key, value]) =>
        value ? <input key={key} type="hidden" name={key} value={value} /> : null,
      )}

      <label htmlFor="q" className="sr-only">
        {t('label')}
      </label>
      <input
        id="q"
        name="q"
        type="search"
        defaultValue={q ?? ''}
        placeholder={t('placeholder')}
        autoComplete="off"
        className="tabular min-w-0 flex-1 rounded-full bg-black/25 px-4 py-2 text-sm text-ink placeholder:text-ink-faint focus-visible:outline-2"
      />
      <button
        type="submit"
        className="eyebrow glass-flat rounded-full px-3 py-2 hover:!text-ink transition-colors"
      >
        {t('submit')}
      </button>
    </form>
  );
}

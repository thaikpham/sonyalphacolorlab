'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';

/**
 * Route-level error boundary. The thrown message is never shown — it can carry
 * database or upstream detail. It goes to the console for debugging instead.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('error');

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-[86rem] flex-1 flex-col items-start justify-center inset-safe py-32">
      <pre aria-hidden className="tabular text-ink-faint text-sm leading-tight">
        {'  ┌─────┐\n  │  !  │\n  └─────┘'}
      </pre>
      <h1 className="mt-6 text-3xl font-semibold tracking-tight">{t('title')}</h1>
      <p className="mt-3 max-w-md text-ink-muted">{t('body')}</p>
      <button
        type="button"
        onClick={reset}
        className="eyebrow glass-flat mt-8 rounded-full px-4 py-2 hover:!text-ink transition-colors"
      >
        {t('action')}
      </button>
      {error.digest && <p className="eyebrow mt-6">ref {error.digest}</p>}
    </main>
  );
}

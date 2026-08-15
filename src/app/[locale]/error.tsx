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
      {/* The mark used to be box-drawing characters in a mono face, which is
          the second typeface this rebuild removed — the glyphs only line up at
          a fixed pitch, so the drawing had to go with the family. A `.surface`
          badge says the same thing in the system's vocabulary. `danger` here is
          classifying the page, not decorating it: this is the error state. */}
      <div
        aria-hidden
        className="surface flex size-16 items-center justify-center text-title-2 font-extrabold text-danger"
      >
        !
      </div>
      <h1 className="mt-6 text-title-1 font-extrabold tracking-[-0.02em]">{t('title')}</h1>
      <p className="mt-3 max-w-md text-body text-ink-muted">{t('body')}</p>
      <button type="button" onClick={reset} className="btn-glass mt-8 cursor-pointer">
        {t('action')}
      </button>
      {error.digest && <p className="meta mt-6">ref {error.digest}</p>}
    </main>
  );
}

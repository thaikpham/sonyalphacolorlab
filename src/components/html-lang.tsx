'use client';

import { useEffect } from 'react';
import { useLocale } from 'next-intl';

/**
 * Keeps `<html lang>` in step with the active locale.
 *
 * The root layout sets it server-side, which is right for the first load and
 * for crawlers — but `<html>` is rendered by `app/layout.tsx`, above the
 * `[locale]` segment, and a client-side navigation never re-renders it. So
 * switching language with the header toggle moved the URL, the copy and the
 * title to English while the document still declared `lang="vi"`, and it stayed
 * wrong until a hard reload.
 *
 * That is precisely the case the attribute exists for: a screen reader picks
 * its phoneme set from it and would read the English page with Vietnamese
 * pronunciation rules for the rest of the session.
 *
 * An effect is the correct tool here rather than a smell — it synchronises
 * React state to an external system (the document element), which is the one
 * job React's own guidance keeps for effects. It sets no state, so it cannot
 * cascade a render.
 */
export function HtmlLang() {
  const locale = useLocale();

  useEffect(() => {
    if (document.documentElement.lang !== locale) {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  return null;
}

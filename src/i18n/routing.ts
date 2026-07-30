import { defineRouting } from 'next-intl/routing';

/**
 * `as-needed` keeps English on the bare path (/recipe/mojave-sun) and prefixes
 * only Vietnamese (/vi/recipe/mojave-sun).
 *
 * That matters for the migration: every URL already indexed and already shared
 * in Facebook groups is an English one, so the English shape must survive the
 * move from sonycolorlab.app. A /en/ prefix would put a redirect hop in front
 * of every existing link.
 */
export const routing = defineRouting({
  locales: ['en', 'vi'],
  defaultLocale: 'en',
  localePrefix: 'as-needed',
});

export type Locale = (typeof routing.locales)[number];

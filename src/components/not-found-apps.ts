/**
 * The apps a missing page can belong to, each with its own index.
 *
 * Plain values, kept out of `not-found-body.tsx` on purpose: that file is
 * `'use client'`, and a server component importing a value from a client
 * module gets a client reference, not the array — `[locale]/not-found.tsx`
 * then failed the build with `NOT_FOUND_APPS.map is not a function`.
 */
export const NOT_FOUND_APPS = ['recipe', 'camera', 'audio', 'blog', 'learn'] as const;
export type NotFoundApp = (typeof NOT_FOUND_APPS)[number];

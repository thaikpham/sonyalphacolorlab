/**
 * Root layout — deliberately renders no element.
 *
 * `<html>` and `<body>` live in `[locale]/layout.tsx` instead, and that is the
 * whole point of this file being empty. `lang` needs the active locale, and
 * this segment has no `[locale]` param to read it from — its only route to one
 * was `getLocale()`, which reads `headers()`. A `headers()` call in the
 * OUTERMOST layout opts every route beneath it out of static generation, so the
 * entire app shipped as `ƒ` (server-rendered on demand): the recipe route's
 * `generateStaticParams` never produced a static page, and every single view
 * re-queried Supabase. That is one half of what spent the project's egress
 * quota; see the header of `catalogue-loader.ts` for the other, larger half.
 *
 * Routes outside the `[locale]` segment render their own document: 404s come
 * from `global-not-found.tsx` next to this file.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}

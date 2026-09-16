import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { AuthProvider } from '@/components/auth-context';
import { AdminShell } from '@/components/admin-ui/shell';
import '../globals.css';

/**
 * The admin department — a second application that happens to share a repo.
 *
 * It is a SIBLING of `[locale]`, not a child, and every consequence of that is
 * the point. The root layout above renders no element (see its header), so this
 * file supplies its own `<html>` — the arrangement `global-not-found.tsx`
 * already uses and that the root layout's header explicitly reserves for
 * routes outside the locale segment. What the placement buys:
 *
 * - No `SiteHeader`: 1,536 lines, four namespaces and a `useSearchParams`
 *   Suspense requirement that an internal tool has no use for.
 * - No `.app-shell` radial washes. The admin ground is flat `--color-void`.
 * - No reach from `[locale]`'s `generateStaticParams`, so nothing here is
 *   prerendered into the public catalogue.
 * - One route tree instead of six near-identical page shells.
 *
 * `src/proxy.ts` excludes `/admin` from the next-intl matcher. Without that,
 * `localePrefix: 'as-needed'` rewrites the bare `/admin` to `/en/admin` and the
 * request lands back in `[locale]` — on pages that are now redirects to here,
 * which is a loop.
 *
 * LOCALE. There is no `[locale]` param to read and `getLocale()` is the
 * `headers()` call that this app removed from the outermost layout. The admin
 * is one operator's tool and that operator reads Vietnamese, so it renders in
 * Vietnamese, named once below. Both catalogues keep their `adminUi` strings —
 * `messages.test.ts` enforces that — so making this switchable later is a
 * change to one constant, not a translation project.
 */

const ADMIN_LOCALE = 'vi' as const;

export const metadata: Metadata = {
  title: {
    default: 'Alpha Admin',
    template: '%s · Alpha Admin',
  },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#07080B',
  colorScheme: 'dark',
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
  width: 'device-width',
  initialScale: 1,
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const messages = (await import(`../../../messages/${ADMIN_LOCALE}.json`)).default;

  /* Explicit namespaces, not the whole catalogue — the same rule the public
     layout follows and `messages.test.ts` checks. `adminUi` is the shell's;
     `admin`, `labAdmin` and `recipeAdmin` belong to the three editors
     below; `auth` is `AuthProvider`'s; `cameras` is read by the product
     editor's spec labels. */
  const clientMessages = {
    admin: messages.admin,
    adminUi: messages.adminUi,
    auth: messages.auth,
    cameras: messages.cameras,
    labAdmin: messages.labAdmin,
    recipeAdmin: messages.recipeAdmin,
  };

  return (
    <html lang={ADMIN_LOCALE} className="h-full antialiased">
      <body className="font-sans min-h-screen-dynamic">
        <NextIntlClientProvider locale={ADMIN_LOCALE} messages={clientMessages}>
          <AuthProvider>
            <AdminShell>{children}</AdminShell>
          </AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AdminSessionProvider, useAdminSession, type AdminRole } from './session';
import { AdminGate } from './gate';

/**
 * The chrome every admin screen sits in, and the only place the gate is read.
 *
 * Three surfaces used to render their own header, their own "checking…", their
 * own not-an-admin panel and their own outage panel — six screens for two
 * states, drifting apart one edit at a time. They are here once, above the
 * editors, so an editor renders only when the gate has actually opened and can
 * assume an admin from its first line.
 *
 * `SiteHeader` is deliberately absent. It is 1,536 lines, reads four message
 * namespaces, needs a `useSearchParams` Suspense boundary of its own and
 * carries the predictive-search fetch — none of which an internal tool for one
 * operator has any use for. This is the whole reason `/admin` lives outside the
 * `[locale]` segment: the public chrome is not inherited, it is simply not
 * there.
 */

/** Sections in the order the nav shows them. */
const SECTIONS = [
  { href: '/admin/colorlab', key: 'sectionColorlab' as const },
  { href: '/admin/wiki', key: 'sectionWiki' as const },
  { href: '/admin/blog', key: 'sectionBlog' as const },
];

/**
 * Security is not in `SECTIONS`, and the omission is deliberate.
 *
 * It is not a fourth app. It is where the operator sets the password and enrols
 * the authenticator that the other three sit behind, so it belongs beside the
 * address in the corner rather than in a row of editorial surfaces.
 */
const SECURITY_HREF = '/admin/security';

function roleNote(role: AdminRole, t: ReturnType<typeof useTranslations>): string | null {
  if (role === 'di') return t('roleDi');
  if (role === 'pe') return t('rolePe');
  return null;
}

function Chrome({ children }: { children: React.ReactNode }) {
  const t = useTranslations('adminUi');
  const { gate, email, role } = useAdminSession();
  const pathname = usePathname();

  const note = roleNote(role, t);

  /* The sign-in and step-up screens replace the whole body rather than
     appearing inside it: a nav that links to three editors is noise to somebody
     who cannot open any of them, and a step-up form that shares a page with
     controls is an invitation to wonder which of them still work. */
  const bare = gate === 'denied' || gate === 'mfaRequired';

  return (
    <div className="flex min-h-screen-dynamic flex-col bg-void font-sans text-ink">
      {bare ? null : (
        <>
          <header className="flex flex-wrap items-center gap-x-6 gap-y-3 px-[clamp(1rem,3vw,2rem)] py-3">
            <Link
              href="/admin"
              className="text-body-lg font-extrabold tracking-[-0.02em] text-ink shrink-0"
            >
              {t('wordmark')}
            </Link>

            {/* The nav renders whatever the gate's answer is. It is navigation, not
                authorisation — every destination re-asks the server, and hiding the
                links would only make an outage look like a smaller product. */}
            <nav className="flex flex-wrap items-center gap-1">
              {SECTIONS.map((s) => {
                const active = pathname === s.href || pathname.startsWith(`${s.href}/`);
                return (
                  <Link
                    key={s.href}
                    href={s.href}
                    aria-current={active ? 'page' : undefined}
                    className={`px-3 py-1.5 rounded-sm text-body-sm font-semibold ${
                      active ? 'surface-selected text-ink' : 'text-ink-muted hover:text-ink'
                    }`}
                  >
                    {t(s.key)}
                  </Link>
                );
              })}
            </nav>

            <div className="ml-auto flex items-center gap-3 text-right">
              {gate === 'admin' && email ? (
                <span className="meta truncate max-w-[18rem]">
                  {email}
                  {note ? ` · ${note}` : ''}
                </span>
              ) : null}
              {/* `next/link` to a plain path, not `@/i18n/navigation`: this document
                  renders outside the locale segment, so there is no request locale
                  for the i18n wrapper to resolve a prefix against. */}
              {gate === 'admin' ? (
                <Link href={SECURITY_HREF} className="meta hover:text-ink shrink-0">
                  {t('sectionSecurity')}
                </Link>
              ) : null}
              <Link href="/" className="meta hover:text-ink shrink-0">
                {t('backToSite')}
              </Link>
            </div>
          </header>
          <div className="seam" />
        </>
      )}
      <AdminGate>{children}</AdminGate>
    </div>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <AdminSessionProvider>
      <Chrome>{children}</Chrome>
    </AdminSessionProvider>
  );
}

'use client';

import Link from 'next/link';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AdminSessionProvider, useAdminSession, type AdminRole } from './session';
import { AdminSignIn } from './sign-in';
import { authBrowser } from '@/lib/supabase/browser';
import { useAuth } from '@/components/auth-context';

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

function Panel({ title, body }: { title: string; body: string }) {
  return (
    <main className="mx-auto flex w-full max-w-[52rem] flex-col gap-3 inset-safe py-20 text-center">
      <h1 className="text-title-1 font-extrabold tracking-[-0.02em] text-ink">{title}</h1>
      <p className="text-body leading-relaxed text-ink-muted">{body}</p>
    </main>
  );
}

function Chrome({ children }: { children: React.ReactNode }) {
  const t = useTranslations('adminUi');
  const { gate, email, role, refresh } = useAdminSession();
  /* Whether a session exists at all. The SERVER deliberately answers the same
     403 for "not signed in" and "signed in, not an admin" — telling them apart
     would say whether a token is still good. The CLIENT already holds its own
     session and discloses nothing by reading it, and the difference decides
     which of two screens actually helps: a sign-in form, or the news that this
     account is not on the list. Without the split a reader who signed in to
     leave a comment and then typed /admin would be handed a login form they
     had already used, forever. */
  const { user, isReady } = useAuth();
  const pathname = usePathname();

  const note = roleNote(role, t);

  /* The sign-in and step-up screens replace the whole body rather than
     appearing inside it: a nav that links to three editors is noise to somebody
     who cannot open any of them, and a step-up form that shares a page with
     controls is an invitation to wonder which of them still work. */
  if (gate === 'denied') {
    /* `isReady` is the third state: the Supabase client restores a session
       asynchronously, so "no user yet" is not "no user". Showing the sign-in
       form during that window makes a signed-in admin's own screen flicker
       through a login prompt on every load. */
    if (!isReady) {
      return (
        <Frame>
          <main className="mx-auto w-full max-w-[86rem] inset-safe py-16">
            <p className="meta">{t('checking')}</p>
          </main>
        </Frame>
      );
    }
    return (
      <Frame>
        {user ? (
          <Panel title={t('notAdminTitle')} body={t('notAdminBody')} />
        ) : (
          <AdminSignIn onSignedIn={refresh} />
        )}
      </Frame>
    );
  }

  if (gate === 'mfaRequired') {
    return (
      <Frame>
        <StepUp onDone={refresh} />
      </Frame>
    );
  }

  return (
    <div className="flex min-h-screen-dynamic flex-col bg-void font-sans text-ink">
      <header className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-white/[0.06] px-[clamp(1rem,3vw,2rem)] py-3">
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

      {gate === 'checking' ? (
        <main className="mx-auto w-full max-w-[86rem] inset-safe py-16">
          <p className="meta">{t('checking')}</p>
        </main>
      ) : gate === 'unavailable' ? (
        <Panel title={t('gateDownTitle')} body={t('gateDownBody')} />
      ) : (
        children
      )}
    </div>
  );
}

/** The ground and the font, with no chrome. Used by the two signed-out screens. */
function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen-dynamic flex-col bg-void font-sans text-ink">{children}</div>
  );
}

/**
 * The step-up form, for a session that has a password behind it and not yet a
 * code.
 *
 * Separate from `AdminSignIn` because the situation is: the operator is signed
 * in, the server knows who they are, and one factor is outstanding. Asking for
 * the address and password again would be asking them to prove something
 * already proved — and would invite them to conclude the password was wrong.
 */
function StepUp({ onDone }: { onDone: () => void }) {
  const t = useTranslations('adminUi');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = authBrowser();
    if (!supabase) return setError('signInNotConfigured');
    setBusy(true);
    setError(null);
    try {
      const { data } = await supabase.auth.mfa.listFactors();
      const totp = data?.totp?.find((f) => f.status === 'verified');
      if (!totp) {
        setError('signInUnavailable');
        return;
      }
      const { error: err } = await supabase.auth.mfa.challengeAndVerify({
        factorId: totp.id,
        code: code.replace(/\s+/g, ''),
      });
      if (err) {
        setError('codeRefused');
        return;
      }
      onDone();
    } catch {
      setError('signInUnavailable');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-[26rem] flex-col gap-5 inset-safe py-20">
      <div className="flex flex-col gap-2">
        <h1 className="text-title-1 font-extrabold tracking-[-0.02em] text-ink">
          {t('stepUpTitle')}
        </h1>
        <p className="text-body leading-relaxed text-ink-muted">{t('stepUpBody')}</p>
      </div>
      <form className="flex flex-col gap-3" onSubmit={submit}>
        <label className="flex flex-col gap-1.5">
          <span className="label text-ink-muted">{t('codeLabel')}</span>
          <input
            className="w-full px-4 min-h-[var(--layout-touch-target)] surface-sunken text-body text-ink placeholder:text-ink-faint"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={9}
            required
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </label>
        <button type="submit" disabled={busy} className="btn-accent cursor-pointer disabled:opacity-50">
          {busy ? t('verifying') : t('verifyBtn')}
        </button>
      </form>
      {error ? <p className="text-body-sm text-danger">{t(error)}</p> : null}
    </main>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <AdminSessionProvider>
      <Chrome>{children}</Chrome>
    </AdminSessionProvider>
  );
}

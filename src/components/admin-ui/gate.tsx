'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAdminSession } from './session';
import { AdminSignIn } from './sign-in';
import { authFailureKey } from './auth-failure';
import { authBrowser } from '@/lib/supabase/browser';
import { useAuth } from '@/components/auth-context';

/**
 * The gate's five answers, as screens, for any surface that needs an admin:
 * the admin department under its header, and the edit routes under the
 * site's. Moved out of `shell.tsx` so the two cannot drift apart.
 */

function Panel({ title, body }: { title: string; body: string }) {
  return (
    <main className="mx-auto flex w-full max-w-[52rem] flex-col gap-3 inset-safe py-20 text-center">
      <h1 className="text-title-1 font-extrabold tracking-[-0.02em] text-ink">{title}</h1>
      <p className="text-body leading-relaxed text-ink-muted">{body}</p>
    </main>
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
        setError(authFailureKey(err, 'codeRefused'));
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

export function AdminGate({ children }: { children: React.ReactNode }) {
  const t = useTranslations('adminUi');
  const { gate, refresh } = useAdminSession();
  /* Whether a session exists at all. The SERVER deliberately answers the same
     403 for "not signed in" and "signed in, not an admin" — telling them apart
     would say whether a token is still good. The CLIENT already holds its own
     session and discloses nothing by reading it, and the difference decides
     which of two screens actually helps: a sign-in form, or the news that this
     account is not on the list. Without the split a reader who signed in to
     leave a comment and then typed /admin would be handed a login form they
     had already used, forever. */
  const { user, isReady } = useAuth();

  if (gate === 'denied') {
    /* `isReady` is the third state: the Supabase client restores a session
       asynchronously, so "no user yet" is not "no user". Showing the sign-in
       form during that window makes a signed-in admin's own screen flicker
       through a login prompt on every load. */
    if (!isReady) {
      return (
        <main className="mx-auto w-full max-w-[86rem] inset-safe py-16">
          <p className="meta">{t('checking')}</p>
        </main>
      );
    }
    return user ? (
      <Panel title={t('notAdminTitle')} body={t('notAdminBody')} />
    ) : (
      <AdminSignIn onSignedIn={refresh} />
    );
  }
  if (gate === 'mfaRequired') return <StepUp onDone={refresh} />;
  if (gate === 'checking') {
    return (
      <main className="mx-auto w-full max-w-[86rem] inset-safe py-16">
        <p className="meta">{t('checking')}</p>
      </main>
    );
  }
  if (gate === 'unavailable') return <Panel title={t('gateDownTitle')} body={t('gateDownBody')} />;
  return <>{children}</>;
}

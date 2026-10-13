'use client';

import { useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import { authBrowser } from '@/lib/supabase/browser';
import { FIELD } from './controls';

/**
 * Signing in to the admin department, without a Google round trip.
 *
 * The operator asked for "type an email and a code from my authenticator app,
 * no Gmail click-through". As literally specified that is ONE factor, not two:
 * all four admin addresses are in plaintext in
 * `supabase/migrations/0011_admin_category_roles.sql`, so an email address is a
 * username and the TOTP seed would have been the only secret — and it would
 * have lived in this deployment, which is the direction the 2026-09-11 incident
 * already came from once.
 *
 * So the UX is what was asked for and the security is not: email, password and
 * the same code from the same app, all typed here, with no redirect and no
 * account chooser. The password is verified by GoTrue and the code steps the
 * session up to `aal2`; `requireAdmin()` refuses anything less as soon as a
 * factor exists. Nothing in this repository stores a password, a seed, or a
 * session — Supabase does, on the control project, where it can be revoked
 * without a redeploy.
 *
 * The public site keeps Google sign-in. A reader posting a photograph has one
 * factor and that is correct; this screen is for the four addresses that can
 * rewrite the catalogue.
 *
 * The code is asked for by the shell's `StepUp`, not here. This form had a
 * code stage of its own that could never render: a correct password fires
 * SIGNED_IN, the gate re-probes for the new identity, and the shell unmounts
 * this form before it could switch stages — leaving an orphaned challenge
 * behind. The probe's `mfaRequired` answer is what opens the code form.
 */

export function AdminSignIn({ onSignedIn }: { onSignedIn: () => void }) {
  const t = useTranslations('adminUi');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fail = useCallback((key: string) => setError(key), []);

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = authBrowser();
    if (!supabase) return fail('signInNotConfigured');
    setBusy(true);
    setError(null);
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) {
        /* One message for a wrong address and a wrong password, deliberately.
           Telling them apart turns this form into an oracle for which of the
           four published addresses still has a live account. */
        fail('signInRefused');
        return;
      }

      /* Enrolled or not, the gate decides what comes next: the server refuses
         an aal1 session for an account with a factor and says so, and the
         shell shows `StepUp` for that answer. */
      onSignedIn();
    } catch {
      fail('signInUnavailable');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-[26rem] flex-col gap-5 inset-safe py-20">
      <div className="flex flex-col gap-2">
        <h1 className="text-title-1 font-extrabold tracking-[-0.02em] text-ink">
          {t('signInTitle')}
        </h1>
        <p className="text-body leading-relaxed text-ink-muted">{t('signInBody')}</p>
      </div>

      <form className="flex flex-col gap-3" onSubmit={submitPassword}>
        <label className="flex flex-col gap-1.5">
          <span className="label text-ink-muted">{t('emailLabel')}</span>
          <input
            className={FIELD}
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="label text-ink-muted">{t('passwordLabel')}</span>
          <input
            className={FIELD}
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(ev) => setPassword(ev.target.value)}
          />
        </label>
        <button type="submit" disabled={busy} className="btn-accent cursor-pointer disabled:opacity-50">
          {busy ? t('signingIn') : t('signInBtn')}
        </button>
      </form>

      {error ? <p className="text-body-sm text-danger">{t(error)}</p> : null}
    </main>
  );
}

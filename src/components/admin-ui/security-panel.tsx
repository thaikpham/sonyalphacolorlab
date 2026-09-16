'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { authBrowser } from '@/lib/supabase/browser';
import { FIELD } from './controls';

/**
 * Setting up the second factor, and the password it sits behind.
 *
 * This screen exists because the operator's account was created by Google
 * sign-in and therefore has no password at all. Without somewhere to set one,
 * "sign in with an email and a password" is advice rather than a feature, and
 * the only way into the admin would still be the Google click-through this work
 * was asked to remove.
 *
 * The order on screen is the order that works: set a password first, because
 * that is the factor the login form asks for, then enrol the app. Enrolling
 * first would leave an account with a second factor and no first one to step up
 * FROM.
 *
 * Nothing here is a secret this application holds. `updateUser` and
 * `mfa.enroll` both go from the browser to GoTrue on the control project; the
 * password never reaches a route in this repository and the TOTP seed exists
 * only in the QR code below and on the operator's phone. That is the whole
 * reason for using Supabase's own MFA instead of a bespoke one — a seed in this
 * deployment's environment is the thing the security review refused.
 */

type Factor = { id: string; status: string; friendly_name?: string };

export function SecurityPanel() {
  const t = useTranslations('adminUi');
  const [factors, setFactors] = useState<Factor[]>([]);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ kind: 'ok' | 'err'; key: string } | null>(null);

  const [enrolling, setEnrolling] = useState<{ id: string; qr: string; secret: string } | null>(
    null,
  );
  const [code, setCode] = useState('');

  /* Fetches and returns; it sets no state, so the mount effect below can decide
     for itself whether the answer still has anywhere to go. */
  const fetchFactors = useCallback(async (): Promise<Factor[] | null> => {
    const supabase = authBrowser();
    if (!supabase) return null;
    const { data } = await supabase.auth.mfa.listFactors();
    return (data?.totp ?? []) as Factor[];
  }, []);

  /** Refresh after an enrolment or a removal, where the panel is certainly alive. */
  const load = useCallback(async () => {
    const rows = await fetchFactors();
    if (rows) setFactors(rows);
  }, [fetchFactors]);

  useEffect(() => {
    let live = true;
    (async () => {
      const rows = await fetchFactors();
      if (live && rows) setFactors(rows);
    })();
    return () => {
      live = false;
    };
  }, [fetchFactors]);

  const setNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = authBrowser();
    if (!supabase) return;
    setBusy(true);
    setNote(null);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      setNote(error ? { kind: 'err', key: 'passwordFailed' } : { kind: 'ok', key: 'passwordSet' });
      if (!error) setPassword('');
    } finally {
      setBusy(false);
    }
  };

  const startEnrol = async () => {
    const supabase = authBrowser();
    if (!supabase) return;
    setBusy(true);
    setNote(null);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: `alpha-admin-${Date.now()}`,
      });
      if (error || !data) {
        setNote({ kind: 'err', key: 'enrolFailed' });
        return;
      }
      setEnrolling({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    } finally {
      setBusy(false);
    }
  };

  const confirmEnrol = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = authBrowser();
    if (!supabase || !enrolling) return;
    setBusy(true);
    setNote(null);
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: enrolling.id,
        code: code.replace(/\s+/g, ''),
      });
      if (error) {
        setNote({ kind: 'err', key: 'codeRefused' });
        return;
      }
      setEnrolling(null);
      setCode('');
      await load();
      setNote({ kind: 'ok', key: 'enrolDone' });
    } finally {
      setBusy(false);
    }
  };

  const removeFactor = async (id: string) => {
    if (!window.confirm(t('unenrolConfirm'))) return;
    const supabase = authBrowser();
    if (!supabase) return;
    setBusy(true);
    try {
      await supabase.auth.mfa.unenroll({ factorId: id });
      await load();
      setNote({ kind: 'ok', key: 'unenrolDone' });
    } finally {
      setBusy(false);
    }
  };

  const verified = factors.filter((f) => f.status === 'verified');

  return (
    <main className="mx-auto flex w-full max-w-[44rem] flex-col gap-8 inset-safe py-12">
      <div className="flex flex-col gap-2">
        <h1 className="text-title-1 font-extrabold tracking-[-0.02em] text-ink">
          {t('securityTitle')}
        </h1>
        <p className="text-body leading-relaxed text-ink-muted">{t('securityBody')}</p>
      </div>

      <section className="surface-raised flex flex-col gap-3 rounded-md p-5">
        <h2 className="text-body-lg font-extrabold text-ink">{t('passwordHeading')}</h2>
        <p className="text-body-sm leading-relaxed text-ink-muted">{t('passwordBody')}</p>
        <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={setNewPassword}>
          <label className="flex grow flex-col gap-1.5">
            <span className="label text-ink-muted">{t('newPasswordLabel')}</span>
            <input
              className={FIELD}
              type="password"
              autoComplete="new-password"
              minLength={12}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button type="submit" disabled={busy} className="btn-accent cursor-pointer disabled:opacity-50">
            {t('setPasswordBtn')}
          </button>
        </form>
      </section>

      <section className="surface-raised flex flex-col gap-4 rounded-md p-5">
        <h2 className="text-body-lg font-extrabold text-ink">{t('totpHeading')}</h2>

        {verified.length > 0 ? (
          <>
            <p className="text-body-sm leading-relaxed text-ink-muted">{t('totpActive')}</p>
            <ul className="flex flex-col gap-2">
              {verified.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-3">
                  <span className="text-body-sm text-ink">{f.friendly_name ?? f.id}</span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void removeFactor(f.id)}
                    className="btn-glass cursor-pointer px-3 text-danger disabled:opacity-50"
                  >
                    {t('unenrolBtn')}
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : enrolling ? (
          <div className="flex flex-col gap-4">
            <p className="text-body-sm leading-relaxed text-ink-muted">{t('scanBody')}</p>
            {/* The QR is a data: URI that GoTrue generated in this response. It
                carries the seed, so it is never stored and never logged — it
                exists for as long as this component is mounted.
                eslint-disable-next-line @next/next/no-img-element */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={enrolling.qr}
              alt={t('qrAlt')}
              className="h-48 w-48 self-start rounded-sm bg-white p-2"
            />
            <details className="text-body-sm text-ink-muted">
              <summary className="cursor-pointer">{t('manualEntry')}</summary>
              <code className="mt-2 block break-all text-ink">{enrolling.secret}</code>
            </details>
            <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={confirmEnrol}>
              <label className="flex grow flex-col gap-1.5">
                <span className="label text-ink-muted">{t('codeLabel')}</span>
                <input
                  className={FIELD}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={9}
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </label>
              <button
                type="submit"
                disabled={busy}
                className="btn-accent cursor-pointer disabled:opacity-50"
              >
                {t('confirmEnrolBtn')}
              </button>
            </form>
          </div>
        ) : (
          <>
            <p className="text-body-sm leading-relaxed text-ink-muted">{t('totpBody')}</p>
            <button
              type="button"
              disabled={busy}
              onClick={() => void startEnrol()}
              className="btn-accent self-start cursor-pointer disabled:opacity-50"
            >
              {t('enrolBtn')}
            </button>
          </>
        )}
      </section>

      {note ? (
        <p className={`text-body-sm ${note.kind === 'err' ? 'text-danger' : 'text-ink-muted'}`}>
          {t(note.key)}
        </p>
      ) : null}
    </main>
  );
}

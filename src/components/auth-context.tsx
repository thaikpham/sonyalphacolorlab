'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Session } from '@supabase/supabase-js';
import { supabaseBrowser } from '@/lib/supabase/browser';

/**
 * Real Google sign-in, via Supabase Auth.
 *
 * What this replaced was a stub: it took an address typed into a form (or the
 * hardcoded `alpha.creator@gmail.com`), wrote it to localStorage, and every
 * write endpoint believed it. There was no Google involved and nothing to
 * forge, because nothing was ever checked.
 *
 * The session here is the real thing, so `accessToken()` returns a JWT the
 * server can verify. Components must send it on every write — the routes reject
 * anything without one. Display name and avatar come from Google via the
 * session, which is why there is no longer anywhere to type them.
 */

export type UserProfile = {
  name: string;
  email: string;
  avatarUrl: string;
};

type AuthContextType = {
  user: UserProfile | null;
  isReady: boolean;
  isLoginModalOpen: boolean;
  openLoginModal: () => void;
  closeLoginModal: () => void;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  /** Bearer token for our own API routes. Null when signed out. */
  accessToken: () => string | null;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function toProfile(session: Session | null): UserProfile | null {
  const u = session?.user;
  if (!u?.email) return null;
  const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
  const name =
    (typeof meta.full_name === 'string' && meta.full_name.trim()) ||
    (typeof meta.name === 'string' && meta.name.trim()) ||
    u.email.split('@')[0];
  const rawAvatar =
    (typeof meta.avatar_url === 'string' && meta.avatar_url.trim()) ||
    (typeof meta.picture === 'string' && meta.picture.trim()) ||
    (typeof meta.avatarUrl === 'string' && meta.avatarUrl.trim()) ||
    '';
  const avatarUrl =
    rawAvatar.startsWith('http://') || rawAvatar.startsWith('https://') || rawAvatar.startsWith('//')
      ? rawAvatar
      : `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0D8ABC&color=fff&bold=true`;
  return { name, email: u.email, avatarUrl };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const t = useTranslations('auth');
  const [session, setSession] = useState<Session | null>(null);
  /* Distinguishes "signed out" from "still restoring" so the UI does not flash
     a login prompt at somebody who is in fact signed in. Starts true when there
     is no Supabase at all — there is then nothing to restore, and deciding that
     during render avoids a setState in the effect below. */
  const [isReady, setIsReady] = useState(() => supabaseBrowser() === null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  /* A code, not a sentence: the message is looked up at render, so switching
     language does not leave a stale error in the other locale on screen. */
  const [error, setError] = useState<'errNotConfigured' | 'errOpenFailed' | null>(null);

  useEffect(() => {
    const supabase = supabaseBrowser();
    if (!supabase) return;

    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setIsReady(true);
    });

    // Fires on sign-in, sign-out, and silent token refresh, so a token handed
    // to fetch() is never a stale one.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (next) setIsLoginModalOpen(false);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const openLoginModal = useCallback(() => setIsLoginModalOpen(true), []);
  const closeLoginModal = useCallback(() => setIsLoginModalOpen(false), []);

  const loginWithGoogle = useCallback(async () => {
    const supabase = supabaseBrowser();
    if (!supabase) {
      setError('errNotConfigured');
      return;
    }
    setError(null);
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      // Come back to the page the reader was reading, in their own locale.
      options: { redirectTo: window.location.href },
    });
    if (err) setError('errOpenFailed');
  }, []);

  const logout = useCallback(async () => {
    await supabaseBrowser()?.auth.signOut();
    setSession(null);
  }, []);

  const accessToken = useCallback(() => session?.access_token ?? null, [session]);

  return (
    <AuthContext.Provider
      value={{
        user: toProfile(session),
        isReady,
        isLoginModalOpen,
        openLoginModal,
        closeLoginModal,
        loginWithGoogle,
        logout,
        accessToken,
      }}
    >
      {children}

      {isLoginModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          {/* The scrim carries the position and the opaque wash; the sheet
              itself carries the elevation. `.surface-raised` is unlayered CSS
              written after `@import "tailwindcss"`, so `bg-*`, `rounded-*` and
              `shadow-*` on the same element are silently dead — which is the
              point: a sheet takes one whole elevation level rather than four
              utilities that drift apart. It appears in place, so it fades in. */}
          <div
            className="surface-raised animate-fade-in w-full max-w-md overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-labelledby="google-login-title"
          >
            <div className="flex flex-col gap-4 p-6">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <GoogleMark className="w-5 h-5 shrink-0" />
                  <h3
                    id="google-login-title"
                    className="text-title-3 font-semibold tracking-[-0.02em] text-ink"
                  >
                    {t('modalTitle')}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={closeLoginModal}
                  className="flex min-h-[var(--layout-touch-target)] min-w-[var(--layout-touch-target)] shrink-0 cursor-pointer items-center justify-center rounded-md text-ink-faint transition-colors hover:bg-white/10 hover:text-ink"
                  aria-label={t('closeModal')}
                >
                  <span aria-hidden className="text-body-lg">
                    ✕
                  </span>
                </button>
              </div>

              <p className="text-body leading-relaxed text-ink-muted">{t('modalBody')}</p>

              {/* The primary action, so it is the accent fill — not a white
                  slab. White ground with black type is the one contrast
                  direction this system does not have. */}
              <button
                type="button"
                onClick={loginWithGoogle}
                className="btn-accent flex w-full cursor-pointer items-center justify-center gap-3"
              >
                <GoogleMark className="w-4 h-4 shrink-0" />
                <span>{t('continueGoogle')}</span>
              </button>

              {error && (
                <p role="alert" className="text-body-sm leading-relaxed text-danger">
                  {t(error)}
                </p>
              )}

              <p className="meta leading-relaxed">{t('privacy')}</p>
            </div>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
}

/**
 * The four raw hexes below are the only ones left in this file and they are
 * deliberate: this is Google's trademark, reproduced to their sign-in branding
 * guidelines, not interface colour. The palette rules — no hex in a component,
 * no red / yellow / green — are about the colours *this* interface chooses; a
 * third party's logo is not one of those choices, and recolouring it to tokens
 * would make it a different mark. Everything around it is tokens.
 */
function GoogleMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.29v3.15C3.26 21.3 7.31 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.29C.47 8.21 0 10.05 0 12s.47 3.79 1.29 5.42l3.99-3.15z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.58l3.99 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
      />
    </svg>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

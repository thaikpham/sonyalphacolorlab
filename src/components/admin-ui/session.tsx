'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
} from 'react';
import { useAuth } from '@/components/auth-context';
import { authBrowser } from '@/lib/supabase/browser';
import type { AdminRole } from '@/lib/admin/category-roles';

/**
 * Who the caller is, asked once for the whole admin department.
 *
 * Both editors used to ask for themselves: each held its own `isAdmin` state,
 * its own `authed()` header builder over `accessToken()`, and its own
 * `/api/admin/session` effect. Two copies of a security-shaped probe is two
 * chances to get it wrong, and they did — see
 * `src/components/admin/session-probe.test.ts` for the one they both got wrong
 * the same way.
 *
 * `gate` carries `adminGate()`'s three outcomes rather than a boolean, because
 * the route answers three things:
 *
 * - 200 `isAdmin: true`  — an editor
 * - 200 `isAdmin: false` — not an editor, and the same answer for a stranger
 *                          and for a signed-in non-admin, deliberately
 * - 503                  — the control project could not be reached, which is
 *                          not a `no`. Reading it as one tells an editor their
 *                          account was removed and hides a live outage behind
 *                          an empty screen.
 *
 * A fetch that throws is the 503 case, not the 403 case: it says nothing about
 * the caller's rights.
 *
 * An answer is about ONE identity, and is only ever shown for that one. The
 * probe used to re-run whenever the session object changed — every hourly
 * token refresh — and a single failed re-probe turned an editor with an open
 * draft into the outage panel, unmounting the draft. And it used to show the
 * last answer to whoever was signed in now: a correct password sign-in fires
 * SIGNED_IN before the new probe has answered, so for one round trip the
 * tokenless probe's `denied` was shown to an administrator, as "not an
 * admin", and the sign-in form was unmounted mid-submit. The probe is keyed on
 * the signed-in address and the refresh nonce now, and while the current
 * identity has no answer yet the gate reads `checking`.
 */

/**
 * `adminGate()`'s outcomes, plus the one the client adds.
 *
 * `mfaRequired` is the server's: a valid session for an account that is on the
 * admin list and has enrolled a second factor, which has not been stepped up.
 * `denied` covers both "not signed in" and "not an admin", because the server
 * deliberately does not tell them apart.
 */
export type AdminGate = 'checking' | 'admin' | 'denied' | 'unavailable' | 'mfaRequired';
export type { AdminRole };

export type AdminSession = {
  gate: AdminGate;
  /** The caller's own address, from the token. Empty until the gate opens. */
  email: string;
  /** `super` until the route says otherwise — see `canManageCategory()`. */
  role: AdminRole;
  /** Re-probes after a sign-in or a step-up, without a full page load. */
  refresh: () => void;
  /**
   * Headers for a write. The bearer token is rebuilt per call rather than
   * captured: the session refreshes underneath a long-lived editor, and a
   * captured token is the one that has expired by the time somebody saves.
   */
  authed: (extra?: HeadersInit) => HeadersInit;
  /**
   * The Authorization header alone, with no `Content-Type`.
   *
   * A multipart upload must let the browser set `Content-Type` itself so the
   * boundary matches the body it generated. `authed()` always names JSON, so
   * an upload that used it would send a boundary-less multipart header and the
   * route would fail to parse a body that is in fact fine.
   */
  bearer: () => HeadersInit;
};

const Ctx = createContext<AdminSession | undefined>(undefined);

export function AdminSessionProvider({
  children,
  probeSignedOut = true,
}: {
  children: React.ReactNode;
  /** False on public pages: a reader with no session is not asked about. */
  probeSignedOut?: boolean;
}) {
  const { accessToken, user } = useAuth();
  /* Who the session is, not which token it holds: a refreshed token is the
     same person and needs no new answer. */
  const identity = user?.email.toLowerCase() ?? '';
  /* The last answer, and the identity it was given for. */
  const [probe, setProbe] = useState<{ for: string; gate: AdminGate } | null>(null);
  const gate: AdminGate = probe && probe.for === identity ? probe.gate : 'checking';
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AdminRole>('super');
  const [nonce, setNonce] = useState(0);
  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  const authed = useCallback(
    (extra: HeadersInit = {}) => {
      const token = accessToken();
      return {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...extra,
      };
    },
    [accessToken],
  );

  const bearer = useCallback((): HeadersInit => {
    const token = accessToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [accessToken]);

  /* The headers as of the moment the probe runs, without making the token a
     dependency of the effect — see the note on `identity`. */
  const headersNow = useEffectEvent(() => authed());

  /* Read through an effect event so the dependency list stays
     `[identity, nonce]` — the probe is about who, not about how it was told. */
  const skipProbe = useEffectEvent(
    () => !probeSignedOut && !identity && authBrowser() !== null,
  );

  useEffect(() => {
    let live = true;
    const asked = identity;
    const settle = (next: AdminGate) => {
      if (live) setProbe({ for: asked, gate: next });
    };
    (async () => {
      if (skipProbe()) {
        settle('denied');
        return;
      }
      try {
        const res = await fetch('/api/admin/session', { headers: headersNow() });
        if (res.status === 503) {
          settle('unavailable');
          return;
        }
        const data = (await res.json()) as {
          isAdmin: boolean;
          email?: string;
          role?: AdminRole;
          error?: string;
        };
        if (!live) return;
        /* The code, not the status: a step-up request answers 200 with
           `isAdmin: false` on purpose, so that the shell can read it on every
           page load without a 403 in the console each time. */
        settle(data.isAdmin ? 'admin' : data.error === 'mfaRequired' ? 'mfaRequired' : 'denied');
        setEmail(data.email ?? '');
        setRole(data.role ?? 'super');
      } catch {
        settle('unavailable');
      }
    })();
    return () => {
      live = false;
    };
    /* `nonce` is the dependency that matters for a step-up: it changes the
       session's assurance level, not who it is, so without it the shell would
       keep showing the code form to somebody who had just used it. */
  }, [identity, nonce]);

  const value = useMemo(
    () => ({ gate, email, role, authed, bearer, refresh }),
    [gate, email, role, authed, bearer, refresh],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/**
 * Throws outside the provider rather than returning a default. A default here
 * would be `gate: 'checking'` forever, or worse `'admin'` — a screen that
 * silently renders its controls to nobody in particular.
 */
export function useAdminSession(): AdminSession {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAdminSession() outside <AdminSessionProvider>');
  return ctx;
}

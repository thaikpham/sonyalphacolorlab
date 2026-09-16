'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/auth-context';

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
 */

export type AdminGate = 'checking' | 'admin' | 'denied' | 'unavailable';
export type AdminRole = 'super' | 'di' | 'pe';

export type AdminSession = {
  gate: AdminGate;
  /** The caller's own address, from the token. Empty until the gate opens. */
  email: string;
  /** `super` until the route says otherwise — see `canManageCategory()`. */
  role: AdminRole;
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

export function AdminSessionProvider({ children }: { children: React.ReactNode }) {
  const { accessToken } = useAuth();
  const [gate, setGate] = useState<AdminGate>('checking');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AdminRole>('super');

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

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const res = await fetch('/api/admin/session', { headers: authed() });
        if (res.status === 503) {
          if (live) setGate('unavailable');
          return;
        }
        const data = (await res.json()) as {
          isAdmin: boolean;
          email?: string;
          role?: AdminRole;
        };
        if (!live) return;
        setGate(data.isAdmin ? 'admin' : 'denied');
        setEmail(data.email ?? '');
        setRole(data.role ?? 'super');
      } catch {
        if (live) setGate('unavailable');
      }
    })();
    return () => {
      live = false;
    };
  }, [authed]);

  const value = useMemo(
    () => ({ gate, email, role, authed, bearer }),
    [gate, email, role, authed, bearer],
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

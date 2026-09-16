import 'server-only';
import { controlAdmin, hasControlConfig } from '@/lib/supabase/server';
import { ControlUnavailableError } from '@/lib/supabase/errors';
import { requireUser, type AuthedUser } from './require-user';

/**
 * Resolves the caller as an admin, or nothing.
 *
 * Two independent checks, in this order and never fewer:
 *
 * 1. `requireUser()` — a Supabase-issued JWT, signature and expiry verified
 *    server-side. This is where the address comes from. It is never read from
 *    the body, a header the client sets, or a query string; that is the trap
 *    `identity-not-from-body.test.ts` was written for, and an admin route is
 *    the worst possible place to repeat it.
 * 2. Membership in `admin_emails`, read with the service-role client because
 *    the table is revoked from anon and authenticated entirely — a browser
 *    cannot enumerate the admin list, or probe whether one address is on it.
 *
 * Returns `null` when the answer is no — unauthenticated, or verified and not
 * on the list. The caller answers 403 for both and must never branch on which,
 * because the difference between "you are not an admin" and "that address is
 * not an admin" is itself a disclosure.
 *
 * It *throws* `ControlUnavailableError` when there is no answer. That is a new
 * third outcome and it replaces something much worse: the allowlist query used
 * to be wrapped in a bare `catch` that fell through to four addresses compiled
 * into the bundle. So on 2026-09-11, with the project answering `402` to every
 * request, the live authorisation path was a hard-coded list — reachable by
 * anyone who could make the query fail. An unreachable allowlist is not
 * evidence that somebody is an administrator. It is 503.
 */

export type AdminRole = 'super' | 'di' | 'pe';

export type AdminUser = AuthedUser & {
  role: AdminRole;
};

export function canManageCategory(role: AdminRole, category: string): boolean {
  if (role === 'super') return true;
  if (role === 'di') return category !== 'audio';
  if (role === 'pe') return category === 'audio';
  return false;
}

/**
 * The one account that exists without a project behind it.
 *
 * Not a bypass: it is reachable only when *no* Supabase boundary is configured
 * at all — which Task 1's parser makes an all-or-nothing state, so a single
 * missing variable in production can no longer unlock it — and only under
 * `NODE_ENV=development`. The address is deliberately not routable. A real one
 * here is how a local convenience becomes a production credential.
 */
const LOCAL_DEV_ADMIN: AdminUser = {
  email: 'dev@localhost',
  name: 'Local development',
  avatarUrl: null,
  role: 'super',
};

export async function requireAdmin(request: Request): Promise<AdminUser | null> {
  if (!hasControlConfig()) {
    return process.env.NODE_ENV === 'development' ? LOCAL_DEV_ADMIN : null;
  }

  const user = await requireUser(request);
  if (!user?.email) return null;

  /* Compared lowercased: Supabase stores the address as the provider sent it,
     and `A@x.com` and `a@x.com` are the same mailbox. Storing the list
     lowercased is not enough on its own — the JWT side has to be folded too. */
  const normalizedEmail = user.email.toLowerCase();

  let data: { email: string; role: string } | null;
  try {
    const result = await controlAdmin()
      .from('admin_emails')
      .select('email, role')
      .eq('email', normalizedEmail)
      .maybeSingle();
    if (result.error) {
      throw new ControlUnavailableError(`admin_emails: ${result.error.message}`);
    }
    data = result.data as { email: string; role: string } | null;
  } catch (error) {
    if (error instanceof ControlUnavailableError) throw error;
    throw new ControlUnavailableError(`admin_emails: ${(error as Error).message}`);
  }

  if (!data) return null;
  return { ...user, role: (data.role as AdminRole) || 'super' };
}

/**
 * The body every admin route returns when the caller is not an admin.
 *
 * A code, not a sentence, for the same reason the community routes use one: a
 * literal here renders untranslated to the other locale and is invisible to the
 * message parity test. The client looks it up under `admin.errors.*`.
 */
export const NOT_ADMIN = { error: 'notAdmin' as const };

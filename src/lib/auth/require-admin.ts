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

/**
 * Why an admin was refused, when the refusal is worth telling them apart from
 * "you are not on the list".
 *
 * `mfaRequired` is reachable only by somebody who has ALREADY proved they hold
 * a valid session for an account that is on the admin list and has enrolled a
 * second factor. It discloses nothing to anyone else — an unauthenticated
 * caller, or one signed in as a non-admin, gets `null` and a flat 403 exactly
 * as before. What it buys is that an administrator who signed in with a
 * password and has not yet entered their code sees "enter your code" instead of
 * "your account was removed" — the same conflation, one layer up, that
 * `admin-gate.ts` exists to prevent.
 */
export class MfaRequiredError extends Error {
  readonly code = 'mfaRequired';
}

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
  id: 'local-dev',
  email: 'dev@localhost',
  name: 'Local development',
  avatarUrl: null,
  /* There is no project, so there is no factor and no token to read a claim
     off. `null` rather than `'aal2'`: this account is not stepped up, it is
     outside the system that has steps. */
  assuranceLevel: null,
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

  /* The ratchet: a second factor is required as soon as one exists, and not
     before.

     Requiring aal2 unconditionally would lock the only operator out of the
     screen they enrol on — there is no other way in, and no second
     administrator to let them back. Requiring it only once a verified factor
     exists cannot lock anyone out, and the moment the operator enrols, a
     stolen password stops being sufficient. The check is on the SERVER and on
     the factor list, so it cannot be skipped by a client that omits a step. */
  if (user.assuranceLevel !== 'aal2' && (await hasVerifiedFactor(user.id))) {
    throw new MfaRequiredError('admin has an enrolled factor but the session is aal1');
  }

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


/**
 * Whether this account has a TOTP factor it has finished enrolling.
 *
 * `unverified` factors are the half-finished state: `mfa.enroll()` creates one
 * and it stays unverified until a code from the app is accepted. Counting those
 * would lock an operator out at exactly the moment they abandoned an enrolment
 * halfway — the worst possible time, because the way back in is the screen they
 * just left.
 *
 * Reached only when the session is NOT already aal2, which after enrolment is
 * the uncommon path. An earlier draft listed every user on the project to find
 * the id; `requireUser()` returns it, so this is one call and does not grow
 * with the user table.
 *
 * A failure is `ControlUnavailableError` like every other control read.
 * Answering "no factor" on an error would silently disable the second factor
 * for as long as the control project was unwell, which is the exact shape of
 * the 2026-09-11 bypass.
 */
async function hasVerifiedFactor(userId: string): Promise<boolean> {
  if (!userId) return false;
  try {
    const { data, error } = await controlAdmin().auth.admin.mfa.listFactors({ userId });
    if (error) throw new ControlUnavailableError(`listFactors: ${error.message}`);
    return (data?.factors ?? []).some((f) => f.status === 'verified');
  } catch (error) {
    if (error instanceof ControlUnavailableError) throw error;
    throw new ControlUnavailableError(`listFactors: ${(error as Error).message}`);
  }
}

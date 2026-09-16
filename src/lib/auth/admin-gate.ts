import 'server-only';
import { ControlUnavailableError } from '@/lib/supabase/errors';
import { MfaRequiredError, requireAdmin, type AdminUser } from './require-admin';

/**
 * The one decision every admin route makes, made once.
 *
 * Seven routes used to each write `const admin = await requireAdmin(request);
 * if (!admin) return 403`. That is correct right up until `requireAdmin` grows
 * a third outcome — which it just did. Left alone, a thrown
 * `ControlUnavailableError` would have escaped every one of those handlers as
 * an uncaught 500, and a 500 from an admin route is indistinguishable from a
 * bug in the save it was refusing.
 *
 * Three rules the shape enforces:
 *
 * - Unauthenticated and non-admin collapse into the same 403. Telling them
 *   apart tells an attacker whether a token they hold is still valid.
 * - "Cannot verify" is 503 and never 403. A restricted control project must not
 *   read to an administrator as "your account was removed".
 * - "Needs a second factor" is a 403 with its own CODE, and never its own
 *   status. The HTTP answer is byte-identical to a plain refusal, so nothing is
 *   disclosed to a caller who does not already hold a valid session for that
 *   account — and the one who does gets told to enter their code instead of
 *   being told their account was removed. That is the same conflation the 503
 *   rule above exists to prevent, arriving from the other direction.
 *
 * Routes call this *before* parsing a body, spending an Anthropic call, or
 * opening a content client, so an unauthorised request costs nothing.
 */

export type AdminGateResult =
  | { ok: true; admin: AdminUser }
  | { ok: false; status: 403; error: 'notAdmin' }
  | { ok: false; status: 403; error: 'mfaRequired' }
  | { ok: false; status: 503; error: 'controlUnavailable' };

export async function adminGate(request: Request): Promise<AdminGateResult> {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return { ok: false, status: 403, error: 'notAdmin' };
    return { ok: true, admin };
  } catch (error) {
    if (error instanceof MfaRequiredError) {
      /* Not logged as a failure. It is the system working: an administrator
         with a second factor has been asked for it. */
      return { ok: false, status: 403, error: 'mfaRequired' };
    }
    if (error instanceof ControlUnavailableError) {
      /* The upstream text names the violation and the project. It goes to the
         log, which is server-side, and never into the response body. */
      console.error('[control] admin gate unavailable:', error.message);
      return { ok: false, status: 503, error: 'controlUnavailable' };
    }
    throw error;
  }
}

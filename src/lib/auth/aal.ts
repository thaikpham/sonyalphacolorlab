import 'server-only';

/**
 * The assurance level a bearer token was issued at.
 *
 * `aal1` is one factor — a password, or a Google sign-in. `aal2` means the
 * session has since satisfied a second factor, which for this project is a TOTP
 * code from the operator's authenticator app.
 *
 * WHY DECODING IS SOUND HERE, and it is worth being precise because decoding a
 * JWT without verifying it is ordinarily a vulnerability:
 *
 * `requireUser()` calls `controlAdmin().auth.getUser(token)` FIRST. That is a
 * round trip to GoTrue, which validates the signature and the expiry against
 * the project's own keys and refuses anything tampered with. Only a token that
 * survived that reaches this function. So the claims inside it are authentic —
 * we are not trusting the token, we are reading a token that has already been
 * proven.
 *
 * The ordering is the entire security property, so it is asserted in
 * `control-boundary.test.ts` rather than left to a comment: a future edit that
 * reads the claim before the verification would turn this into a header an
 * attacker writes themselves.
 *
 * Returning `null` for anything unparseable is deliberate. An absent or
 * malformed claim must never read as "elevated" — `requireAdmin()` treats
 * anything that is not exactly `aal2` as not stepped up.
 */

export type AssuranceLevel = 'aal1' | 'aal2';

export function assuranceLevelOf(verifiedToken: string): AssuranceLevel | null {
  const parts = verifiedToken.split('.');
  if (parts.length !== 3) return null;

  let payload: unknown;
  try {
    /* base64url, which `Buffer.from(…, 'base64')` does not decode on its own:
       `-` and `_` have to become `+` and `/` or a token containing either
       silently produces different bytes and then fails to parse — which would
       read as "no claim" and quietly drop an admin back to aal1. */
    const json = Buffer.from(
      parts[1].replace(/-/g, '+').replace(/_/g, '/'),
      'base64',
    ).toString('utf8');
    payload = JSON.parse(json);
  } catch {
    return null;
  }

  if (typeof payload !== 'object' || payload === null) return null;
  const aal = (payload as { aal?: unknown }).aal;
  return aal === 'aal2' ? 'aal2' : aal === 'aal1' ? 'aal1' : null;
}

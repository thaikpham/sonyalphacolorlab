import 'server-only';
import { controlAdmin, hasControlConfig } from '@/lib/supabase/server';
import { ControlUnavailableError, isCredentialRejection } from '@/lib/supabase/errors';
import { communityErrorBody } from '@/lib/community/errors';

/**
 * Resolves the caller from a verified Supabase session, never from the request
 * body.
 *
 * This exists because the community routes used to take `authorName` and
 * `authorEmail` straight out of the JSON payload. Nothing checked them, so a
 * plain curl could post a comment as any person — the site owner included — and
 * heart votes could be stuffed indefinitely with invented addresses. Identity
 * has to come from something the client cannot forge.
 *
 * The bearer token is a Supabase-issued JWT; `getUser(token)` validates the
 * signature and expiry against the project's own keys. A tampered or expired
 * token resolves to nothing, and callers must treat that as unauthenticated.
 *
 * It asks the *control* project and only the control project. The content
 * project has no Auth configured and never sees this token: every content write
 * goes through a route handler here that has already verified the session.
 *
 * `null` and a throw mean different things and the difference is load-bearing.
 * `null` is "this credential is not good". `ControlUnavailableError` is "the
 * project could not tell us" — a spent egress quota, a 5xx, a transport
 * failure. Collapsing the second into the first signs every reader out during
 * an incident, and used to be what tipped the admin guard into a hard-coded
 * bypass.
 */

export type AuthedUser = {
  email: string;
  name: string;
  avatarUrl: string | null;
};

export async function requireUser(request: Request): Promise<AuthedUser | null> {
  if (!hasControlConfig()) return null;

  const header = request.headers.get('authorization') ?? '';
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
  if (!token) return null;

  let data: Awaited<ReturnType<ReturnType<typeof controlAdmin>['auth']['getUser']>>['data'];
  try {
    const result = await controlAdmin().auth.getUser(token);
    if (result.error) {
      if (isCredentialRejection((result.error as { status?: number }).status)) return null;
      throw new ControlUnavailableError(`getUser: ${result.error.message}`);
    }
    data = result.data;
  } catch (error) {
    if (error instanceof ControlUnavailableError) throw error;
    /* A TypeError from fetch, an aborted request, a proxy's HTML error page
       failing to parse. None of them is evidence about the token. */
    throw new ControlUnavailableError(`getUser: ${(error as Error).message}`);
  }

  if (!data.user) {
    /* No error and no user is not a shape GoTrue produces. Something between us
       and the project rewrote the answer, so believing it would sign the reader
       out mid-session. */
    throw new ControlUnavailableError('getUser returned neither a user nor an error.');
  }
  if (!data.user.email) return null;

  {

    // Google supplies these; fall back to the address rather than trusting any
    // client-supplied display name.
    const meta = (data.user.user_metadata ?? {}) as Record<string, unknown>;
    const name =
      typeof meta.full_name === 'string' && meta.full_name.trim()
        ? meta.full_name.trim()
        : typeof meta.name === 'string' && meta.name.trim()
          ? meta.name.trim()
          : data.user.email.split('@')[0];
    const rawAvatar =
      (typeof meta.avatar_url === 'string' && meta.avatar_url.trim()) ||
      (typeof meta.picture === 'string' && meta.picture.trim()) ||
      (typeof meta.avatarUrl === 'string' && meta.avatarUrl.trim()) ||
      '';
    const avatarUrl =
      rawAvatar.startsWith('http://') || rawAvatar.startsWith('https://') || rawAvatar.startsWith('//')
        ? rawAvatar
        : null;

    return { email: data.user.email, name: name.slice(0, 100), avatarUrl };
  }
}

/**
 * The 401 body every community write path returns, so they stay consistent.
 *
 * A code, not a sentence: this used to be a Vietnamese literal, which renders
 * untranslated to an English reader and is invisible to the message parity
 * test. The client looks the code up in `community.errors.*`.
 */
export const UNAUTHENTICATED = communityErrorBody('unauthenticated');

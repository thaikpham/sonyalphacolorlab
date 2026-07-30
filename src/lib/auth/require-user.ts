import 'server-only';
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase/server';

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
 */

export type AuthedUser = {
  email: string;
  name: string;
  avatarUrl: string | null;
};

export async function requireUser(request: Request): Promise<AuthedUser | null> {
  if (!isSupabaseConfigured()) return null;

  const header = request.headers.get('authorization') ?? '';
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
  if (!token) return null;

  try {
    const { data, error } = await supabaseAdmin().auth.getUser(token);
    if (error || !data.user?.email) return null;

    // Google supplies these; fall back to the address rather than trusting any
    // client-supplied display name.
    const meta = (data.user.user_metadata ?? {}) as Record<string, unknown>;
    const name =
      typeof meta.full_name === 'string' && meta.full_name.trim()
        ? meta.full_name.trim()
        : typeof meta.name === 'string' && meta.name.trim()
          ? meta.name.trim()
          : data.user.email.split('@')[0];
    const avatarUrl =
      typeof meta.avatar_url === 'string' && meta.avatar_url.startsWith('https://')
        ? meta.avatar_url
        : null;

    return { email: data.user.email, name: name.slice(0, 100), avatarUrl };
  } catch {
    // A verification failure is an unauthenticated request, never an allowed one.
    return null;
  }
}

/** The 401 body every community write path returns, so they stay consistent. */
export const UNAUTHENTICATED = { error: 'Bạn cần đăng nhập để thực hiện thao tác này.' };

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Browser-side Supabase client, used for authentication only.
 *
 * Safe to ship: it carries the anon key, which is public by design. What makes
 * that safe is that the anon role has no write policy on any table and no read
 * privilege on the email columns — see `0004_comments_and_proposals.sql`. This
 * client never writes; it exchanges a Google sign-in for a session and hands
 * the access token to our own route handlers, which verify it server-side.
 *
 * `detectSessionInUrl` is what completes the PKCE round trip when Google sends
 * the reader back with a `?code=`, so no dedicated callback route is needed.
 */

let client: SupabaseClient | null = null;

export function supabaseBrowser(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // Without credentials the app still runs off the seed files, so callers must
  // cope with there being no auth rather than the module throwing on import.
  if (!url || !anonKey) return null;

  client ??= createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
  });
  return client;
}

/**
 * Positive evidence that the project is refusing to authenticate anybody.
 *
 * `signInWithOAuth` under PKCE builds the authorize URL locally and hands the
 * browser to it. It never calls Supabase, so it cannot fail and cannot report
 * that the project is not answering — it returns no error and the reader lands
 * on whatever `/auth/v1/authorize` serves. When the project is restricted (a
 * spent egress quota answers *every* endpoint, auth included, with `402` and a
 * JSON body) that is a raw error document with no way back to the site.
 *
 * One cheap GET first turns that into a translated line inside the sign-in
 * sheet. `/auth/v1/settings` is the right probe: it is the same gateway the
 * redirect would hit, it is CORS-enabled, it needs only the anon key, and it
 * carries no session state.
 *
 * Deliberately fails OPEN. Only a definitive non-OK response counts as an
 * outage; a timeout, a DNS failure or an offline reader returns `false` and the
 * redirect is allowed to try. Blocking a legitimate sign-in over a flaky
 * connection would be a worse bug than the one this prevents.
 */
export async function isAuthOutage(): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return false;

  try {
    const res = await fetch(`${url}/auth/v1/settings`, {
      headers: { apikey: anonKey },
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    return !res.ok;
  } catch {
    return false;
  }
}

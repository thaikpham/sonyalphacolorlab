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

import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Server-side Supabase access.
 *
 * Both clients are created lazily so the app boots — and the whole test suite
 * runs — with no credentials configured at all. `isSupabaseConfigured()` is what
 * the data layer branches on to fall back to the seed files.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const isSupabaseConfigured = () => Boolean(url && anonKey);

let readClient: SupabaseClient | null = null;

/** Anon client. RLS limits it to published rows — see migration 0001. */
export function supabaseRead(): SupabaseClient {
  if (!url || !anonKey) {
    throw new Error(
      'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.',
    );
  }
  readClient ??= createClient(url, anonKey, { auth: { persistSession: false } });
  return readClient;
}

/**
 * Service-role client. Bypasses RLS, so it is only ever for seeding and admin
 * scripts — never import this into anything that renders a page.
 */
export function supabaseAdmin(): SupabaseClient {
  if (!url || !serviceKey) {
    throw new Error(
      'Admin access is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
    );
  }
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

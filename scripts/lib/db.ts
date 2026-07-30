import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Service-role client for scripts.
 *
 * Scripts build their own client rather than importing `src/lib/supabase/server`
 * — that module carries `import 'server-only'`, which throws outside a React
 * Server Component and would otherwise force us to weaken the guard that keeps
 * the service-role key out of the app bundle.
 *
 * Bypasses RLS. Only ever for seeding and admin tasks.
 */
export function adminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (scripts read .env.local).',
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

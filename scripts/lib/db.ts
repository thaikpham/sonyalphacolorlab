import type { SupabaseClient } from '@supabase/supabase-js';

import { adminClient as targetedAdminClient } from '../supabase/clients';
import type { Target } from '../supabase/args';

/**
 * The old generic script client, now unable to guess.
 *
 * It used to read `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`,
 * which meant "the project" — fine when there was one. With two projects in two
 * organisations, a seed script that reads whichever variables happen to be
 * loaded can write the catalogue into the project that holds Auth, and nothing
 * in its output would say so.
 *
 * The signature is the fix: there is no call without a target. Everything else
 * lives in `scripts/supabase/clients.ts`, which this re-exports so the existing
 * seed scripts keep one short import.
 */
export function adminClient(target: Target): SupabaseClient {
  return targetedAdminClient(target);
}

export type { Target };

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { Target } from './args';

/**
 * A script's Supabase client, chosen by an argument rather than by luck.
 *
 * Scripts build their own client rather than importing `src/lib/supabase/server`
 * — that module carries `import 'server-only'`, which throws outside a React
 * Server Component and would otherwise force us to weaken the guard that keeps
 * a service credential out of the app bundle.
 *
 * What changed with the split is where the credentials come from. There is no
 * longer a generic pair that "the project" means: `control` and `content` name
 * different projects in different organisations, and the caller has already
 * been made to say which.
 *
 * Error messages name the missing *variable*, never a value. A script that
 * echoes a secret into a terminal has published it into scrollback, shell
 * history and any CI log that captured the run.
 */

const VARS: Record<Target, { url: string; secret: string; anon: string; ref: string }> = {
  control: {
    url: 'NEXT_PUBLIC_AUTH_SUPABASE_URL',
    secret: 'AUTH_SUPABASE_SECRET_KEY',
    anon: 'NEXT_PUBLIC_AUTH_SUPABASE_ANON_KEY',
    ref: 'CONTROL_SUPABASE_PROJECT_REF',
  },
  content: {
    url: 'NEXT_PUBLIC_CONTENT_SUPABASE_URL',
    secret: 'CONTENT_SUPABASE_SECRET_KEY',
    anon: 'CONTENT_SUPABASE_ANON_KEY',
    ref: 'CONTENT_SUPABASE_PROJECT_REF',
  },
};

function need(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`${name} is not set. Scripts read .env.local; see .env.example.`);
  }
  return value.trim();
}

/** Bypasses RLS. Only ever for seeding, export, import and admin tasks. */
export function adminClient(target: Target): SupabaseClient {
  const vars = VARS[target];
  return createClient(need(vars.url), need(vars.secret), { auth: { persistSession: false } });
}

/** Anon client, for proving what a browser can and cannot see. */
export function readClient(target: Target): SupabaseClient {
  const vars = VARS[target];
  return createClient(need(vars.url), need(vars.anon), { auth: { persistSession: false } });
}

/** The public origin, for printing which project a command is about to touch. */
export function originOf(target: Target): string {
  return need(VARS[target].url).replace(/\/+$/, '');
}

/**
 * The project ref the Supabase CLI needs.
 *
 * Operations-only, and deliberately separate from the runtime URL: the CLI
 * pushes migrations, and a ref derived from whichever URL happened to be in the
 * environment is exactly the inference this module exists to remove.
 */
export function projectRef(target: Target): string {
  return need(VARS[target].ref);
}

export const VARIABLE_NAMES = VARS;

import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import {
  AUTH_ANON_VAR,
  AUTH_SECRET_VAR,
  AUTH_URL_VAR,
  CONTENT_ANON_VAR,
  CONTENT_SECRET_VAR,
  CONTENT_URL_VAR,
  SupabaseConfigurationError,
  configurationMode,
  hasContentConfig,
  hasControlConfig,
} from './config';

/**
 * Server-side Supabase access, one factory per trust boundary.
 *
 * Four clients where there were two, because "which project" and "with whose
 * authority" are separate questions and the old pair could only answer the
 * second. A single `supabaseAdmin()` was reachable from an article write, a
 * comment write and an Auth token check alike; after the split those are three
 * different projects' worth of blast radius.
 *
 * - `controlRead()`   anon, control plane — public operational reads under RLS.
 * - `controlAdmin()`  secret, control plane — token checks, `admin_emails`,
 *                     community writes.
 * - `contentRead()`   anon, content plane — published catalogue and articles.
 * - `contentAdmin()`  secret, content plane — validated administrator writes,
 *                     only ever after `requireAdmin()` has passed.
 *
 * Every client is created lazily, so the app boots and the whole suite runs
 * with no credentials at all: that absence is the seed-backed offline mode, and
 * `hasControlConfig()` / `hasContentConfig()` are what the data layer branches
 * on. A *partial* absence is not a mode — `configurationMode` throws on it.
 */

const clients = new Map<string, SupabaseClient>();

function client(kind: string, urlVar: string, keyVar: string): SupabaseClient {
  /* Revalidates the whole matrix on first use rather than at import time. A
     module-scope throw would take the build down instead of the request that
     actually needed a credential, and would break the credential-free gate. */
  if (configurationMode(process.env) === 'offline') {
    throw new SupabaseConfigurationError(
      `Supabase is not configured, so ${kind} is unavailable. This is expected in seed mode; ` +
        'the caller should have branched on hasControlConfig()/hasContentConfig() first.',
    );
  }
  const cached = clients.get(kind);
  if (cached) return cached;

  const created = createClient(process.env[urlVar] as string, process.env[keyVar] as string, {
    auth: { persistSession: false },
  });
  clients.set(kind, created);
  return created;
}

/** Anon client on the control plane. RLS limits it to published rows. */
export function controlRead(): SupabaseClient {
  return client('controlRead', AUTH_URL_VAR, AUTH_ANON_VAR);
}

/**
 * Secret client on the control plane. Bypasses RLS, so it is only for verifying
 * a bearer token, reading `admin_emails`, and writing community tables whose
 * rows carry an email the anon role must never see.
 */
export function controlAdmin(): SupabaseClient {
  return client('controlAdmin', AUTH_URL_VAR, AUTH_SECRET_VAR);
}

/** Anon client on the content plane. Published catalogue and articles only. */
export function contentRead(): SupabaseClient {
  return client('contentRead', CONTENT_URL_VAR, CONTENT_ANON_VAR);
}

/**
 * Secret client on the content plane. Bypasses RLS. Every call site must have
 * passed `requireAdmin()` — which asks the *control* plane — before reaching
 * this, and must write exactly once.
 */
export function contentAdmin(): SupabaseClient {
  return client('contentAdmin', CONTENT_URL_VAR, CONTENT_SECRET_VAR);
}

export { hasContentConfig, hasControlConfig };

/** Test seam: the module caches clients, and a suite may change the env. */
export function resetSupabaseClients(): void {
  clients.clear();
}

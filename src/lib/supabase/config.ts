/**
 * The trust boundary, expressed as a pure function.
 *
 * Two Supabase projects now back this application. The control plane
 * (`nqeedlgzaewccqztqvik`) owns Auth, administrator roles and community
 * operations; the content plane owns recipes, the Sony catalogue and the
 * article corpus. They are in separate organisations on purpose, so a content
 * egress incident can no longer take sign-in down with it — which is exactly
 * what happened on 2026-09-11.
 *
 * The six variables below are the whole contract. Their old, ambiguous
 * predecessors (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
 * `SUPABASE_SERVICE_ROLE_KEY`) selected one project for all four jobs, so
 * repointing them would have moved Auth by accident. They are gone rather than
 * aliased: an alias is how the accident comes back.
 *
 * This module is deliberately free of `server-only` and of every side effect.
 * It takes an environment object so the matrix can be tested exhaustively, and
 * so the browser bundle can import the validator without importing a secret.
 * Nothing here reads a secret's *value*; it only asks whether one is present.
 */

export type SupabaseMode = 'offline' | 'online';

export type SupabaseEnv = NodeJS.ProcessEnv | Record<string, string | undefined>;

export class SupabaseConfigurationError extends Error {
  readonly code = 'invalidSupabaseConfiguration';

  constructor(message: string) {
    super(message);
    this.name = 'SupabaseConfigurationError';
  }
}

export const AUTH_URL_VAR = 'NEXT_PUBLIC_AUTH_SUPABASE_URL';
export const AUTH_ANON_VAR = 'NEXT_PUBLIC_AUTH_SUPABASE_ANON_KEY';
export const AUTH_SECRET_VAR = 'AUTH_SUPABASE_SECRET_KEY';
export const CONTENT_URL_VAR = 'NEXT_PUBLIC_CONTENT_SUPABASE_URL';
export const CONTENT_ANON_VAR = 'CONTENT_SUPABASE_ANON_KEY';
export const CONTENT_SECRET_VAR = 'CONTENT_SUPABASE_SECRET_KEY';

/** The two boundaries, each complete or entirely absent — never in between. */
const BOUNDARIES = [
  { plane: 'control', vars: [AUTH_URL_VAR, AUTH_ANON_VAR, AUTH_SECRET_VAR] },
  { plane: 'content', vars: [CONTENT_URL_VAR, CONTENT_ANON_VAR, CONTENT_SECRET_VAR] },
] as const;

/* A Vercel variable that exists but holds an empty string is the same thing as
   a missing one, and it is the likelier mistake: the dashboard keeps the row. */
function present(env: SupabaseEnv, name: string): boolean {
  return (env[name] ?? '').trim().length > 0;
}

/**
 * A Supabase project origin, with nothing else accepted.
 *
 * HTTPS because the anon key travels on every request. The `.supabase.co`
 * suffix because the only two legitimate values are project refs on that
 * domain, and because `next.config.ts` and the Storage allowlist derive their
 * hosts from these strings — a typo that resolves somewhere else would widen
 * the image allowlist rather than fail. The suffix is checked against the
 * parsed hostname, never the raw text, so `...supabase.co.evil.test` fails.
 */
function normaliseOrigin(env: SupabaseEnv, name: string): string {
  const raw = (env[name] ?? '').trim();
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new SupabaseConfigurationError(`${name} is not a valid URL.`);
  }
  if (parsed.protocol !== 'https:') {
    throw new SupabaseConfigurationError(`${name} must use https.`);
  }
  if (parsed.hostname !== 'supabase.co' && !parsed.hostname.endsWith('.supabase.co')) {
    throw new SupabaseConfigurationError(`${name} must be a *.supabase.co project origin.`);
  }
  return parsed.origin;
}

/** Server-only maintenance switch; see the rollback section of the spec. */
export function isRollbackMode(env: SupabaseEnv): boolean {
  return env.SUPABASE_ROLLBACK_MODE === 'true';
}

/** Server-only maintenance switch: reject content mutations, keep reads up. */
export function isContentAdminFrozen(env: SupabaseEnv): boolean {
  return env.CONTENT_ADMIN_FROZEN === 'true';
}

/**
 * `offline` means the repository's seed-backed mode, which local development
 * and the whole test suite run in. It is only legal when *nothing* is set;
 * production verification rejects it separately, in `check-supabase-env.ts`.
 */
export function configurationMode(env: SupabaseEnv): SupabaseMode {
  const configured = BOUNDARIES.map((b) => b.vars.filter((v) => present(env, v)));
  const total = configured[0].length + configured[1].length;

  if (total === 0) return 'offline';

  BOUNDARIES.forEach((boundary, index) => {
    if (configured[index].length === boundary.vars.length) return;
    const missing = boundary.vars.filter((v) => !present(env, v));
    throw new SupabaseConfigurationError(
      `The ${boundary.plane} plane is half configured: ${missing.join(', ')} ` +
        'must be set too, or all six Supabase variables must be absent for seed mode.',
    );
  });

  const authOrigin = normaliseOrigin(env, AUTH_URL_VAR);
  const origin = normaliseOrigin(env, CONTENT_URL_VAR);

  if (authOrigin === origin && !isRollbackMode(env)) {
    throw new SupabaseConfigurationError(
      `${AUTH_URL_VAR} and ${CONTENT_URL_VAR} point at the same project, which rebuilds the ` +
        'single failure domain the split removes. Set SUPABASE_ROLLBACK_MODE=true only for the ' +
        'documented emergency rollback.',
    );
  }

  return 'online';
}

/** The content project's origin, or null in seed mode. Never throws on absence. */
export function contentOrigin(env: SupabaseEnv): string | null {
  if (configurationMode(env) === 'offline') return null;
  return normaliseOrigin(env, CONTENT_URL_VAR);
}

/** The control project's origin, or null in seed mode. */
export function controlOrigin(env: SupabaseEnv): string | null {
  if (configurationMode(env) === 'offline') return null;
  return normaliseOrigin(env, AUTH_URL_VAR);
}

/*
 * The zero-argument wrappers the application calls.
 *
 * Both boundaries are complete or both are absent — `configurationMode` has
 * already rejected everything else — so these two agree by construction. They
 * stay separate names because a call site reads for *which* plane it needs, and
 * a future paid tier could legitimately make them diverge.
 *
 * Memoized on the six values, because these are hot. `isDevStore()` alone calls
 * through here on every admin read, and a single recipe page render reaches it
 * a dozen times — each one re-reading six variables and building two `URL`s to
 * reach the same answer. Keyed on the values rather than cached outright so a
 * test that stubs the environment still sees its own configuration; the parse
 * is pure, so a matching key can only mean a matching result.
 */
let modeMemo: { key: string; mode: SupabaseMode } | null = null;

function currentMode(): SupabaseMode {
  const key = [
    AUTH_URL_VAR,
    AUTH_ANON_VAR,
    AUTH_SECRET_VAR,
    CONTENT_URL_VAR,
    CONTENT_ANON_VAR,
    CONTENT_SECRET_VAR,
    'SUPABASE_ROLLBACK_MODE',
  ]
    .map((name) => `${name}=${process.env[name] ?? ''}`)
    .join('\u0000');

  if (modeMemo?.key !== key) {
    /* Deliberately not caught. A half-configured production deployment is a
       deployment error, and the throw is what `check-supabase-env.ts` reports
       before it ships — swallowing it here would serve a mixed topology. */
    modeMemo = { key, mode: configurationMode(process.env) };
  }
  return modeMemo.mode;
}

export const hasControlConfig = (): boolean => currentMode() === 'online';
export const hasContentConfig = (): boolean => currentMode() === 'online';

/**
 * Deployment-time verification of the two-boundary topology.
 *
 * `npm run verify` deliberately runs with no credentials at all — that is what
 * proves the seed-backed offline mode still works, and it is why the gate
 * cannot be the thing that catches a half-configured deployment. This script is
 * the other half: it runs inside `vercel env run`, where the real values exist.
 *
 * It prints variable *names* and never a value. A script that echoes a secret
 * into CI logs has published it.
 *
 * Usage:
 *   npm run check:supabase-env
 *   vercel env pull && npx tsx --env-file=.env.local scripts/check-supabase-env.ts
 */

import {
  SupabaseConfigurationError,
  configurationMode,
  contentOrigin,
  controlOrigin,
  isContentAdminFrozen,
  isRollbackMode,
} from '../src/lib/supabase/config';

const isProduction = process.env.VERCEL_ENV === 'production';

function fail(message: string): never {
  console.error(`\n  ✗ Supabase configuration\n    ${message}\n`);
  process.exit(1);
}

let mode: 'offline' | 'online';
try {
  mode = configurationMode(process.env);
} catch (error) {
  if (error instanceof SupabaseConfigurationError) fail(error.message);
  throw error;
}

if (mode === 'offline') {
  /* Absent everywhere is a legitimate local state and a fatal production one.
     Serving production from the compiled seeds would resurrect content that an
     administrator deleted, which is worse than an outage because it is silent. */
  if (isProduction) {
    fail(
      'Production has no Supabase configured, so it would serve the compiled seed snapshots ' +
        'and could resurrect deleted content. Set all six variables.',
    );
  }
  console.log('\n  ✓ Supabase configuration: offline (seed mode). Valid outside production.\n');
  process.exit(0);
}

const control = controlOrigin(process.env);
const content = contentOrigin(process.env);

console.log('\n  ✓ Supabase configuration: online');
console.log(`    control plane  ${control}`);
console.log(`    content plane  ${content}`);

if (isRollbackMode(process.env)) {
  console.warn(
    '\n  ⚠  SUPABASE_ROLLBACK_MODE=true — the origin check that keeps the two planes apart is\n' +
      '     suspended. This is the documented emergency path only. Unset it once the content\n' +
      '     project is serving again, or the next content incident takes Auth down with it.\n',
  );
}

if (isContentAdminFrozen(process.env)) {
  console.warn(
    '\n  ⚠  CONTENT_ADMIN_FROZEN=true — administrator content writes are rejected. Public reads,\n' +
      '     Auth and community operations are unaffected. Expected only during a cutover delta.\n',
  );
}

console.log('');

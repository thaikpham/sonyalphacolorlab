/**
 * Is a project answering, and which one did we just ask?
 *
 * Written for the state this migration began in: the control project returning
 * `402 exceed_cached_egress_quota` to *every* endpoint, Auth included, while
 * the management API still reported `ACTIVE_HEALTHY`. The dashboard said fine;
 * the gateway said no. Anything that reads the dashboard is not a health check.
 *
 * So it asks the two endpoints the application actually depends on, with the
 * anon key, and prints the status it got. No interpretation, no retries.
 *
 *   npm run supabase:health -- --target control
 *   npm run supabase:health -- --target content
 */

import { originOf, VARIABLE_NAMES } from './clients';
import { ArgumentError, requireTarget } from './args';

async function probe(url: string, apikey: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { apikey },
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
    const body = res.ok ? '' : ` ${(await res.text()).slice(0, 200)}`;
    return `${res.status}${body}`;
  } catch (error) {
    return `unreachable (${(error as Error).message})`;
  }
}

async function main() {
  const { target } = requireTarget(process.argv.slice(2));
  const origin = originOf(target);
  const anon = process.env[VARIABLE_NAMES[target].anon] ?? '';

  console.log(`\n  ${target} plane`);
  console.log(`  ${origin}\n`);
  console.log(`  auth/v1/settings   ${await probe(`${origin}/auth/v1/settings`, anon)}`);
  console.log(`  rest/v1/           ${await probe(`${origin}/rest/v1/`, anon)}`);
  console.log('');
}

main().catch((error) => {
  console.error(error instanceof ArgumentError ? `\n  ${error.message}\n` : error);
  process.exit(1);
});

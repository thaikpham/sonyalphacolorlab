import 'server-only';
import { configurationMode } from './config';
import { ContentUnavailableError } from './errors';

/**
 * Which source a published-content read is allowed to come from.
 *
 * There are three states and the middle one used to be invisible:
 *
 * 1. **Offline** — no Supabase configured anywhere. The compiled seed snapshots
 *    are the source. This is local development and the whole test suite.
 * 2. **Online, answered** — the content project's answer is the source, empty
 *    included.
 * 3. **Online, failed** — there is no source. It throws.
 *
 * The third case is the whole point of this module. Every reader used to wrap
 * its query in a `withSeedFallback()` that caught anything and returned the
 * seeds, which reads as resilience and is actually silent data loss running
 * backwards: `data/*.seed.json` is a Git-time snapshot, so a content outage
 * would republish every recipe and article an administrator had since
 * unpublished or deleted. Nobody would see an error. They would see deleted
 * content back on the site, indistinguishable from the real thing, for as long
 * as the outage lasted.
 *
 * An empty array is equally load-bearing: it is a *successful* answer and must
 * survive. `listSlugs` used to throw on an empty result specifically to reach
 * the seed fallback — with the fallback gone, that throw would turn a genuinely
 * empty catalogue into an outage, so it goes too.
 *
 * Failing loudly is cheaper than it looks. Next.js keeps serving the last good
 * Data Cache entry for a hot path, so a throw here reaches a reader only on a
 * cold miss, and the locale error boundary renders a translated apology rather
 * than yesterday's catalogue.
 */

/**
 * The only parts of a Supabase error safe to log.
 *
 * Not the whole object: PostgREST attaches `details` and `hint`, which quote
 * the failing row, and a thrown `fetch` error can carry the request URL with
 * the apikey in a query string. Logs get shipped somewhere.
 */
function safeError(error: unknown): string {
  if (!error || typeof error !== 'object') return String(error);
  const e = error as { status?: unknown; code?: unknown; message?: unknown };
  return [
    e.status === undefined ? null : `status=${String(e.status)}`,
    e.code === undefined ? null : `code=${String(e.code)}`,
    typeof e.message === 'string' ? e.message : null,
  ]
    .filter(Boolean)
    .join(' ');
}

export async function contentOrOfflineSeed<T>(
  label: string,
  remote: () => Promise<T>,
  seed: () => T,
): Promise<T> {
  /* The branch is on configuration alone — never on whether the remote call
     happened to work. That is what makes "the seeds are the source" a
     deployment-time fact rather than a runtime accident. */
  if (configurationMode(process.env) === 'offline') return seed();

  try {
    return await remote();
  } catch (error) {
    console.error(`[content] ${label} unavailable:`, safeError(error));
    throw new ContentUnavailableError(label);
  }
}

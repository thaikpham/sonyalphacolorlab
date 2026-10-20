/**
 * Which message an admin auth refusal earns: "that was wrong" or "the service
 * is not answering".
 *
 * auth-js reports both in the same `{ error }` — a network failure or a 5xx is
 * an `AuthRetryableFetchError` that is returned, not thrown — so reading every
 * `error` as a refusal told an operator their password was wrong during a
 * control-plane outage. Only a 400, 401 or 422 is GoTrue saying no to what was
 * typed; anything else (no status, 402, 429, 5xx, an unreadable response) is
 * the service, and the reader is told to try again rather than to doubt the
 * password or their phone's clock.
 */

const REFUSED = new Set([400, 401, 422]);

export function authFailureKey<K extends string>(
  err: { name?: string; status?: number },
  refusedKey: K,
): K | 'signInUnavailable' {
  if (err.name === 'AuthRetryableFetchError' || err.name === 'AuthUnknownError') {
    return 'signInUnavailable';
  }
  return err.status !== undefined && REFUSED.has(err.status) ? refusedKey : 'signInUnavailable';
}

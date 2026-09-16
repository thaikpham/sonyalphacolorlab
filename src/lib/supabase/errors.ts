/**
 * Two outages that must never be confused with two other things.
 *
 * `null` from an auth guard means "this caller is not who they'd need to be".
 * A thrown `ControlUnavailableError` means "we could not find out". The old
 * guard returned `null` for both, and then — because a locked-out administrator
 * is intolerable — fell through to a hard-coded allowlist. That is how a
 * quota-restricted project came to sit one `catch` away from authorising four
 * addresses with no verification at all.
 *
 * `ContentUnavailableError` is the read-side twin. A content read that fails
 * must not fall back to the compiled seed snapshots: the seeds are a Git-time
 * copy, so serving them would republish articles and recipes an administrator
 * has since deleted or unpublished. Louder failure, quieter data loss.
 *
 * Both carry a `code` the routes put on the wire and the client looks up in
 * `messages/*.json`. Neither ever carries the upstream Supabase message: that
 * text names tables and quota states and belongs only in the server log.
 */

export class ControlUnavailableError extends Error {
  readonly code = 'controlUnavailable';

  constructor(message = 'The control plane did not answer.') {
    super(message);
    this.name = 'ControlUnavailableError';
  }
}

export class ContentUnavailableError extends Error {
  readonly code = 'contentUnavailable';

  constructor(message = 'The content plane did not answer.') {
    super(message);
    this.name = 'ContentUnavailableError';
  }
}

/**
 * Whether a PostgREST/GoTrue status says the *credential* is wrong, as opposed
 * to the project being unable to answer.
 *
 * 400/401/403 are statements about the token. Everything else — 402 from a
 * spent egress quota, 429, any 5xx, or no status at all because the transport
 * never got a reply — is a statement about the project, and must fail closed.
 */
export function isCredentialRejection(status: unknown): boolean {
  return status === 400 || status === 401 || status === 403;
}

/**
 * Sent on every response (next.config.ts `headers()`). No Content-Security-
 * Policy: a wrong one breaks pages without an error anyone sees, so it is its
 * own piece of work. X-Frame-Options DENY: nothing frames this site, and the
 * blog's own embeds are frames of other sites, which this does not govern.
 */
export const SECURITY_HEADERS: readonly { key: string; value: string }[] = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'X-Frame-Options', value: 'DENY' },
]

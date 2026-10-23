import 'server-only';
import { z } from 'zod';
import { isExpiringImageHost } from './image-hosts';

export { EXPIRING_IMAGE_HOSTS, isExpiringImageHost } from './image-hosts';

/**
 * Reading a community POST body, before any handler logic runs.
 *
 * `await request.json()` used to sit inside each handler's outage `try`. A
 * malformed body threw a SyntaxError (or, for `null`, a TypeError on the
 * destructure), the catch logged "Supabase unavailable", and the caller got
 * 500 saveFailed — a client bug reported as a server outage in both the log
 * and the status. And nothing bounded the size: a signed-in caller could store
 * a 4 MB `settings` blob on the control plane five times a minute.
 *
 * So the body is read once, here: capped, parsed, and required to be a JSON
 * object. Anything else is the caller's error and answers 4xx.
 */

/**
 * Comfortably above the largest legitimate body — a 2000-character comment in
 * Vietnamese, or a full Picture Profile proposal, are both under 8 KiB.
 */
export const MAX_COMMUNITY_BODY_BYTES = 16 * 1024;

export type JsonBody =
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; error: 'missingFields' | 'payloadTooLarge' };

export async function readJsonBody(
  request: Request,
  maxBytes = MAX_COMMUNITY_BODY_BYTES,
): Promise<JsonBody> {
  // The header is a claim, not a measurement, so it only short-circuits; the
  // byte count below is what actually decides.
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) {
    return { ok: false, error: 'payloadTooLarge' };
  }

  let text: string;
  try {
    text = await request.text();
  } catch {
    return { ok: false, error: 'missingFields' };
  }
  if (new TextEncoder().encode(text).length > maxBytes) {
    return { ok: false, error: 'payloadTooLarge' };
  }

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return { ok: false, error: 'missingFields' };
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, error: 'missingFields' };
  }
  return { ok: true, body: body as Record<string, unknown> };
}

/** The same shape the `recipe_slug` CHECK constraints enforce. */
export const recipeSlugSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Invalid slug');

/**
 * https only, bounded like `community_photos.image_url` — both ends: the
 * CHECK is `length between 12 and 2048`, and `https://a.b` (11) passed here
 * to fail there as a 500.
 *
 * And on a host that keeps it: a Facebook or Instagram CDN link expires, so it
 * fails with its own message, which the routes answer as `expiringImageHost`
 * rather than as an invalid URL.
 */
export const EXPIRING_IMAGE_HOST_ISSUE = 'expiringImageHost';

export const httpsImageUrlSchema = z
  .string()
  .url()
  .min(12)
  .max(2048)
  .refine((u) => u.startsWith('https://'), { message: 'Image URL must use https://' })
  .refine((u) => !isExpiringImageHost(u), { message: EXPIRING_IMAGE_HOST_ISSUE });

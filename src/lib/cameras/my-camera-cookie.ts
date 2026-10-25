/**
 * Where "My camera" is kept: one cookie, never the URL (ADR 0006).
 *
 * A shared link must not carry the sender's camera onto the recipient's
 * catalogue, so the choice is not in the path or the query string — and it
 * is not part of any cache key either: the browse page filters in memory
 * after one unfiltered `listRecipes(locale)`.
 *
 * Not `httpOnly`, on purpose. The recipe page is prerendered, and reading the
 * cookie there on the server would turn every recipe page into a per-request
 * render (`cookies()` is a request-time API). Its warning line is a small
 * client island that reads the cookie in the browser instead. The value is a
 * model code or a generic id — a preference, not a credential.
 *
 * Client-safe: no evidence, no catalogue, no `next/headers`.
 */

export const MY_CAMERA_COOKIE = 'colorlab-camera';

/** A year. The choice is a property of the reader's kit, which rarely changes. */
export const MY_CAMERA_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * The longest value accepted. Model codes are short (`ILCE-7RM4A`) and the
 * generic ids shorter than this; anything longer is malformed, not looked up.
 */
const MAX_VALUE_LENGTH = 32;

const CHOICE_SHAPE = /^[A-Za-z0-9][A-Za-z0-9-]*$/;

/** The shape a stored value must have before it is even looked up. */
export function wellFormedChoice(value: unknown): value is string {
  return typeof value === 'string' && value.length <= MAX_VALUE_LENGTH && CHOICE_SHAPE.test(value);
}

/** One cookie's value from a `document.cookie` string, or `null`. */
export function readCookie(cookieString: string, name: string): string | null {
  for (const part of cookieString.split(';')) {
    const at = part.indexOf('=');
    if (at < 0 || part.slice(0, at).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(at + 1).trim());
    } catch {
      return null;
    }
  }
  return null;
}

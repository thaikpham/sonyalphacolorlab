/**
 * Image hosts whose links stop working.
 *
 * Facebook and Instagram serve photographs from signed CDN URLs that expire.
 * Stored as a contributed photograph, one renders for a while and then leaves
 * a dead tile that `recipe-gallery.tsx` drops on its `onError` — the
 * contribution simply disappears, with nothing to say why. Refused at the door
 * instead: by the routes (`httpsImageUrlSchema`) and, before the round trip,
 * by the two forms that take a photo URL.
 *
 * Its own file, not `request.ts`: that module is `server-only`, and both forms
 * are client components.
 */
export const EXPIRING_IMAGE_HOSTS: readonly string[] = ['fbcdn.net', 'fbsbx.com', 'cdninstagram.com'];

/** The hostname is one of the list, or a subdomain of one. Unparseable is not expiring. */
export function isExpiringImageHost(url: string): boolean {
  let host: string;
  try {
    /* A fully-qualified name may end in dots (`fbcdn.net.`) and resolves to
       the same host, so they come off before the match. */
    host = new URL(url).hostname.toLowerCase().replace(/\.+$/, '');
  } catch {
    return false;
  }
  return EXPIRING_IMAGE_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
}

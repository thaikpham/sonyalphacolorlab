import { describe, expect, it } from 'vitest';
import { EXPIRING_IMAGE_HOSTS, isExpiringImageHost } from './image-hosts';

/**
 * Facebook and Instagram serve photographs from signed CDN links that expire,
 * so a contributed one renders for a while and then leaves a dead tile. The
 * list is matched on the hostname — the host itself or a subdomain of it,
 * never a name that merely ends in the same letters.
 */
describe('isExpiringImageHost', () => {
  it('matches a subdomain of a listed host', () => {
    expect(isExpiringImageHost('https://scontent.xx.fbcdn.net/a.jpg')).toBe(true);
    expect(isExpiringImageHost('https://scontent-sin6-1.cdninstagram.com/v/t51/a.jpg?oh=1&oe=2')).toBe(true);
    expect(isExpiringImageHost('https://lookaside.fbsbx.com/lookaside/crawler/media/?media_id=1')).toBe(true);
  });

  it('matches every listed host itself, whatever its case', () => {
    for (const host of EXPIRING_IMAGE_HOSTS) {
      expect(isExpiringImageHost(`https://${host}/a.jpg`), host).toBe(true);
      expect(isExpiringImageHost(`https://${host.toUpperCase()}/a.jpg`), host).toBe(true);
    }
  });

  it('matches a fully-qualified name written with a trailing dot', () => {
    /* `fbcdn.net.` is the same host; the WHATWG parser keeps the dot. */
    expect(isExpiringImageHost('https://scontent.xx.fbcdn.net./a.jpg')).toBe(true);
    expect(isExpiringImageHost('https://cdninstagram.com../a.jpg')).toBe(true);
  });

  it('does not match a name that only ends in the same letters', () => {
    expect(isExpiringImageHost('https://notfbcdn.net/a.jpg')).toBe(false);
  });

  it('leaves a host that keeps its links alone', () => {
    expect(isExpiringImageHost('https://flickr.com/a.jpg')).toBe(false);
    expect(isExpiringImageHost('https://live.staticflickr.com/65535/a.jpg')).toBe(false);
    /* The path is not the host: a link that mentions the CDN is not on it. */
    expect(isExpiringImageHost('https://example.com/fbcdn.net/a.jpg')).toBe(false);
  });

  it('calls an unparseable string not expiring, and leaves it to the URL check', () => {
    expect(isExpiringImageHost('not a url')).toBe(false);
  });
});

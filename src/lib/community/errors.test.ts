import { describe, expect, it } from 'vitest';
import { communityErrorOf, isCommunityErrorCode } from './errors';

describe('isCommunityErrorCode', () => {
  it('accepts a code the catalogue defines', () => {
    expect(isCommunityErrorCode('rateLimited')).toBe(true);
  });

  it.each(['constructor', 'toString', 'hasOwnProperty', '__proto__'])(
    'rejects the prototype key %s, so it falls back to `unknown`',
    (key) => {
      expect(isCommunityErrorCode(key)).toBe(false);
    },
  );

  it('rejects anything that is not a string', () => {
    expect(isCommunityErrorCode(429)).toBe(false);
    expect(isCommunityErrorCode(null)).toBe(false);
  });
});

describe('communityErrorOf', () => {
  const json = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

  it('reads the code a refusal carries', async () => {
    expect(await communityErrorOf(json({ ok: false, error: 'rateLimited' }, 429))).toBe('rateLimited');
  });

  it('reads the code from a failed GET that still lists nothing', async () => {
    /* The read routes answer 503 with an empty list beside the code, so the
       client must not mistake the list for "there are none". */
    expect(
      await communityErrorOf(json({ ok: false, error: 'controlUnavailable', comments: [] }, 503)),
    ).toBe('controlUnavailable');
  });

  it('falls back to unknown for a code this bundle does not know', async () => {
    expect(await communityErrorOf(json({ ok: false, error: 'somethingNew' }, 400))).toBe('unknown');
    expect(await communityErrorOf(json({ ok: false, error: 'constructor' }, 400))).toBe('unknown');
  });

  it('falls back to unknown for a body that is not JSON, such as a proxy page', async () => {
    expect(await communityErrorOf(new Response('<html>502</html>', { status: 502 }))).toBe('unknown');
  });
});

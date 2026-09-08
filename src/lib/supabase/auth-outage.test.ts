import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { isAuthOutage } from './browser';

/**
 * The sign-in button's only chance to notice the project is dead.
 *
 * `signInWithOAuth` under PKCE builds the authorize URL locally and navigates
 * to it — no network call, therefore no error, however restricted the project
 * is. When a spent egress quota made every endpoint answer `402`, clicking
 * "Continue with Google" replaced the site with a JSON error document. The
 * modal's own `errOpenFailed` never fired, because nothing had failed in the
 * only place that was watching.
 *
 * The two directions matter equally and pull opposite ways:
 *
 * - A definitive non-OK answer must be caught, or the reader is thrown out of
 *   the site again.
 * - Anything short of that must NOT be caught. A timeout or an offline reader
 *   is not evidence the project is down, and refusing a legitimate sign-in over
 *   a flaky connection would be a worse bug than the one this prevents.
 */

const URL_KEY = 'NEXT_PUBLIC_SUPABASE_URL';
const KEY_KEY = 'NEXT_PUBLIC_SUPABASE_ANON_KEY';

const original = { url: process.env[URL_KEY], key: process.env[KEY_KEY] };

/**
 * Responds like the platform gateway does, without touching the network.
 *
 * The parameters are declared even though no stub reads them: they are what
 * types `spy.mock.calls`, which the last case asserts against.
 */
function stubFetch(impl: (url: string, init: RequestInit) => Promise<Response> | never) {
  const spy = vi.fn(impl);
  vi.stubGlobal('fetch', spy);
  return spy;
}

beforeEach(() => {
  process.env[URL_KEY] = 'https://project.supabase.co';
  process.env[KEY_KEY] = 'anon-key';
});

afterEach(() => {
  vi.unstubAllGlobals();
  if (original.url === undefined) delete process.env[URL_KEY];
  else process.env[URL_KEY] = original.url;
  if (original.key === undefined) delete process.env[KEY_KEY];
  else process.env[KEY_KEY] = original.key;
});

describe('isAuthOutage', () => {
  it('reports an outage on the 402 a restricted project actually returns', async () => {
    stubFetch(async () =>
      new Response(
        JSON.stringify({
          message:
            'Service for this project is restricted due to the following violations: exceed_cached_egress_quota.',
        }),
        { status: 402 },
      ),
    );

    await expect(isAuthOutage()).resolves.toBe(true);
  });

  it('reports an outage for any other non-OK status', async () => {
    for (const status of [500, 503]) {
      stubFetch(async () => new Response(null, { status }));
      await expect(isAuthOutage()).resolves.toBe(true);
    }
  });

  it('lets sign-in proceed when the project answers', async () => {
    stubFetch(async () => new Response(JSON.stringify({ external: { google: true } }), { status: 200 }));

    await expect(isAuthOutage()).resolves.toBe(false);
  });

  it('fails open when the probe itself cannot complete', async () => {
    // A timeout, a DNS failure and an offline reader all arrive as a throw, and
    // none of them says anything about whether the project is healthy.
    stubFetch(() => {
      throw new DOMException('The operation was aborted.', 'TimeoutError');
    });

    await expect(isAuthOutage()).resolves.toBe(false);
  });

  it('fails open when there is no Supabase configured at all', async () => {
    // The app runs off the seed files with no credentials. There is nothing to
    // probe, and `loginWithGoogle` already refuses earlier with
    // `errNotConfigured` — a second, vaguer message would only muddy that one.
    delete process.env[URL_KEY];
    const spy = stubFetch(async () => new Response(null, { status: 200 }));

    await expect(isAuthOutage()).resolves.toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });

  it('probes the auth gateway the redirect would hit, carrying the anon key', async () => {
    const spy = stubFetch(async () => new Response(null, { status: 200 }));

    await isAuthOutage();

    const [url, init] = spy.mock.calls[0];
    expect(url).toBe('https://project.supabase.co/auth/v1/settings');
    expect((init.headers as Record<string, string>).apikey).toBe('anon-key');
    // A cached 200 from before the restriction would defeat the whole check.
    expect(init.cache).toBe('no-store');
  });
});

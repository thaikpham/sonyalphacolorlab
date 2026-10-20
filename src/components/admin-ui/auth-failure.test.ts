import { readFileSync } from 'node:fs';
import { AuthApiError, AuthRetryableFetchError, AuthUnknownError } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { authFailureKey } from './auth-failure';

/**
 * An outage is not a wrong password.
 *
 * auth-js turns a network failure and a 5xx into `AuthRetryableFetchError` and
 * *returns* it in `{ error }` — `signInWithPassword` and `challengeAndVerify`
 * do not throw. So `if (err) fail('signInRefused')` told an operator their
 * password was wrong during a control-plane outage, and the `catch` that says
 * "the service is not answering" could not be reached for one.
 */

describe('authFailureKey', () => {
  it.each([
    ['a network failure', new AuthRetryableFetchError('fetch failed', 0)],
    ['a 503', new AuthRetryableFetchError('Service Unavailable', 503)],
    ['an unreadable response', new AuthUnknownError('bad json', null)],
    ['a 500 from the API', new AuthApiError('boom', 500, undefined)],
    ['a 402 restriction', new AuthApiError('Payment required', 402, undefined)],
    ['a 429 rate limit', new AuthApiError('Too many requests', 429, undefined)],
  ])('answers unavailable for %s', (_, err) => {
    expect(authFailureKey(err, 'signInRefused')).toBe('signInUnavailable');
  });

  it.each([400, 401, 422])('keeps the one refused message for a %i', (status) => {
    const err = new AuthApiError('refused', status, undefined);
    expect(authFailureKey(err, 'signInRefused')).toBe('signInRefused');
    expect(authFailureKey(err, 'codeRefused')).toBe('codeRefused');
  });
});

describe('every admin auth call reads its error through it', () => {
  const files = {
    'sign-in.tsx': "authFailureKey(err, 'signInRefused')",
    'shell.tsx': "authFailureKey(err, 'codeRefused')",
    'security-panel.tsx': "authFailureKey(error, 'codeRefused')",
  };

  it.each(Object.entries(files))('%s', (file, call) => {
    const source = readFileSync(`src/components/admin-ui/${file}`, 'utf8');
    expect(source).toContain(call);
    expect(source).not.toMatch(/fail\('signInRefused'\)|setError\('codeRefused'\)|key: 'codeRefused'/);
  });
});

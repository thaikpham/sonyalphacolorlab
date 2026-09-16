import { describe, expect, it } from 'vitest';

import { afterEach, vi } from 'vitest';

import {
  SupabaseConfigurationError,
  configurationMode,
  contentOrigin,
  hasContentConfig,
  hasControlConfig,
  isRollbackMode,
} from './config';

/**
 * The configuration matrix is the whole safety argument for the split.
 *
 * Two projects now sit behind six variables, and the dangerous states are not
 * the empty one or the full one — they are the halves. A deployment carrying
 * the Auth pair but no content credential would quietly read published content
 * from nowhere; one carrying a content URL but no secret would accept an admin
 * save and fail after authorising it. Worst of all, a copy-paste that points
 * both boundaries at `nqeedlgzaewccqztqvik` looks completely healthy and
 * silently rebuilds the single point of failure this work exists to remove.
 *
 * So the parser refuses every partial topology rather than degrading, and it
 * refuses a shared origin unless somebody deliberately asked for the documented
 * emergency rollback.
 */

const AUTH_URL = 'https://nqeedlgzaewccqztqvik.supabase.co';
const CONTENT_URL = 'https://touiyczjvnuaxfzulgeq.supabase.co';

const AUTH_PUBLIC = {
  NEXT_PUBLIC_AUTH_SUPABASE_URL: AUTH_URL,
  NEXT_PUBLIC_AUTH_SUPABASE_ANON_KEY: 'auth-anon',
};
const AUTH_COMPLETE = { ...AUTH_PUBLIC, AUTH_SUPABASE_SECRET_KEY: 'auth-secret' };

const CONTENT_PUBLIC = {
  NEXT_PUBLIC_CONTENT_SUPABASE_URL: CONTENT_URL,
  CONTENT_SUPABASE_ANON_KEY: 'content-anon',
};
const CONTENT_COMPLETE = { ...CONTENT_PUBLIC, CONTENT_SUPABASE_SECRET_KEY: 'content-secret' };

const COMPLETE = { ...AUTH_COMPLETE, ...CONTENT_COMPLETE };
const COMPLETE_WITH_SHARED_ORIGIN = {
  ...COMPLETE,
  NEXT_PUBLIC_CONTENT_SUPABASE_URL: AUTH_URL,
};

describe('configurationMode', () => {
  it.each([
    ['all six absent', {}, 'offline'],
    ['both complete', COMPLETE, 'online'],
  ])('%s', (_label, env, expected) => {
    expect(configurationMode(env)).toBe(expected);
  });

  it.each([
    ['auth URL only', { NEXT_PUBLIC_AUTH_SUPABASE_URL: AUTH_URL }],
    ['auth pair without secret', AUTH_PUBLIC],
    ['content URL only', { NEXT_PUBLIC_CONTENT_SUPABASE_URL: CONTENT_URL }],
    ['content read pair without secret', CONTENT_PUBLIC],
    ['auth complete but content absent', AUTH_COMPLETE],
    ['content complete but auth absent', CONTENT_COMPLETE],
  ])('rejects %s', (_label, env) => {
    expect(() => configurationMode(env)).toThrow(SupabaseConfigurationError);
  });

  it('treats an empty string as absent, so a blank Vercel entry is not a half topology', () => {
    expect(configurationMode({ NEXT_PUBLIC_AUTH_SUPABASE_URL: '', CONTENT_SUPABASE_ANON_KEY: '  ' })).toBe(
      'offline',
    );
  });

  it('rejects a shared origin, which is the failure mode that looks healthy', () => {
    expect(() => configurationMode(COMPLETE_WITH_SHARED_ORIGIN)).toThrow(SupabaseConfigurationError);
  });

  it('allows one shared origin only in explicit rollback mode', () => {
    expect(
      configurationMode({ ...COMPLETE_WITH_SHARED_ORIGIN, SUPABASE_ROLLBACK_MODE: 'true' }),
    ).toBe('online');
  });

  it('accepts only the literal string true as the rollback switch', () => {
    for (const value of ['TRUE', '1', 'yes', 'true ']) {
      expect(() =>
        configurationMode({ ...COMPLETE_WITH_SHARED_ORIGIN, SUPABASE_ROLLBACK_MODE: value }),
      ).toThrow(SupabaseConfigurationError);
    }
  });

  it.each([
    ['a non-HTTPS origin', 'http://touiyczjvnuaxfzulgeq.supabase.co'],
    ['a non-Supabase host', 'https://content.example.com'],
    ['a lookalike host', 'https://touiyczjvnuaxfzulgeq.supabase.co.evil.test'],
    ['unparseable text', 'touiyczjvnuaxfzulgeq'],
  ])('rejects %s as a content URL', (_label, url) => {
    expect(() => configurationMode({ ...COMPLETE, NEXT_PUBLIC_CONTENT_SUPABASE_URL: url })).toThrow(
      SupabaseConfigurationError,
    );
  });

  it('names the offending variable without quoting any value', () => {
    let message = '';
    try {
      configurationMode(AUTH_COMPLETE);
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain('NEXT_PUBLIC_CONTENT_SUPABASE_URL');
    expect(message).not.toContain('auth-secret');
  });

  it('ignores a trailing slash when comparing the two origins', () => {
    expect(() =>
      configurationMode({ ...COMPLETE, NEXT_PUBLIC_CONTENT_SUPABASE_URL: `${AUTH_URL}/` }),
    ).toThrow(SupabaseConfigurationError);
  });
});

describe('contentOrigin', () => {
  it('returns the normalised origin, so callers never rebuild a URL from a trailing slash', () => {
    expect(contentOrigin({ ...COMPLETE, NEXT_PUBLIC_CONTENT_SUPABASE_URL: `${CONTENT_URL}/` })).toBe(
      CONTENT_URL,
    );
  });

  it('returns null offline rather than throwing, because seeds have no origin', () => {
    expect(contentOrigin({})).toBeNull();
  });
});

describe('isRollbackMode', () => {
  it('is false unless the switch is exactly true', () => {
    expect(isRollbackMode({})).toBe(false);
    expect(isRollbackMode({ SUPABASE_ROLLBACK_MODE: 'TRUE' })).toBe(false);
    expect(isRollbackMode({ SUPABASE_ROLLBACK_MODE: 'true' })).toBe(true);
  });
});

describe('the memoized wrappers', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('is offline with nothing configured', () => {
    expect(hasControlConfig()).toBe(false);
    expect(hasContentConfig()).toBe(false);
  });

  it('notices the environment changing, so a stubbed test is not served a stale answer', () => {
    /* The memo is keyed on the six values rather than cached outright. Caching
       the first answer would make the second test in any file that stubs the
       environment read the first one's configuration. */
    expect(hasControlConfig()).toBe(false);
    for (const [key, value] of Object.entries(COMPLETE)) vi.stubEnv(key, value);
    expect(hasControlConfig()).toBe(true);
    expect(hasContentConfig()).toBe(true);
    vi.unstubAllEnvs();
    expect(hasControlConfig()).toBe(false);
  });

  it('still throws on a half-configured boundary rather than answering false', () => {
    /* Swallowing this to keep the wrapper total would serve a mixed topology:
       Auth against one project and content against nothing. */
    vi.stubEnv('NEXT_PUBLIC_AUTH_SUPABASE_URL', AUTH_URL);
    expect(() => hasControlConfig()).toThrow(SupabaseConfigurationError);
  });

  it('notices the rollback switch alone changing', () => {
    for (const [key, value] of Object.entries(COMPLETE_WITH_SHARED_ORIGIN)) vi.stubEnv(key, value);
    expect(() => hasContentConfig()).toThrow(SupabaseConfigurationError);
    vi.stubEnv('SUPABASE_ROLLBACK_MODE', 'true');
    expect(hasContentConfig()).toBe(true);
  });
});

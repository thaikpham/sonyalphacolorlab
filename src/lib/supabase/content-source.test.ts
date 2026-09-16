import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { contentOrOfflineSeed } from './content-source';
import { ContentUnavailableError } from './errors';

/**
 * The rule that stops an outage from republishing deleted content.
 *
 * Three branches, and only the first is the obvious one. What this pins is that
 * an *online* failure never reaches the seed: `data/*.seed.json` is a Git-time
 * snapshot, so serving it during a content incident silently restores every
 * recipe and article an administrator has unpublished since the last commit —
 * with no error anywhere, and no way for a reader to tell.
 *
 * And that an empty answer is an answer. `listSlugs` used to throw on an empty
 * result purely to reach the fallback; with the fallback gone that would turn a
 * legitimately empty catalogue into a site-wide outage.
 */

const REMOTE = [{ id: 'from-the-database' }];
const SEED = [{ id: 'from-the-snapshot' }];

const ONLINE = {
  NEXT_PUBLIC_AUTH_SUPABASE_URL: 'https://nqeedlgzaewccqztqvik.supabase.co',
  NEXT_PUBLIC_AUTH_SUPABASE_ANON_KEY: 'a',
  AUTH_SUPABASE_SECRET_KEY: 'b',
  NEXT_PUBLIC_CONTENT_SUPABASE_URL: 'https://touiyczjvnuaxfzulgeq.supabase.co',
  CONTENT_SUPABASE_ANON_KEY: 'c',
  CONTENT_SUPABASE_SECRET_KEY: 'd',
};

function goOnline() {
  for (const [key, value] of Object.entries(ONLINE)) vi.stubEnv(key, value);
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('contentOrOfflineSeed', () => {
  it('returns the remote answer when online', async () => {
    goOnline();
    await expect(contentOrOfflineSeed('x', async () => REMOTE, () => SEED)).resolves.toEqual(REMOTE);
  });

  it('keeps an empty online answer empty', async () => {
    goOnline();
    await expect(contentOrOfflineSeed('x', async () => [], () => SEED)).resolves.toEqual([]);
  });

  it('throws on an online failure instead of serving the snapshot', async () => {
    goOnline();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const seed = vi.fn(() => SEED);
    await expect(
      contentOrOfflineSeed('x', async () => {
        throw new Error('exceed_cached_egress_quota');
      }, seed),
    ).rejects.toBeInstanceOf(ContentUnavailableError);
    expect(seed).not.toHaveBeenCalled();
  });

  it('serves the snapshot offline without calling the remote at all', async () => {
    const remote = vi.fn(async () => REMOTE);
    await expect(contentOrOfflineSeed('x', remote, () => SEED)).resolves.toEqual(SEED);
    expect(remote).not.toHaveBeenCalled();
  });

  it('logs status, code and message but not the detail or hint PostgREST attaches', async () => {
    goOnline();
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(
      contentOrOfflineSeed('recipes.list', async () => {
        throw {
          status: 402,
          code: 'PGRST301',
          message: 'restricted',
          details: 'Key (slug)=(daylight-cinema) is present in recipes.',
          hint: 'apikey=eyJhbGciOi',
        };
      }, () => SEED),
    ).rejects.toThrow('recipes.list');
    const line = logged.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(line).toContain('status=402');
    expect(line).toContain('restricted');
    expect(line).not.toContain('daylight-cinema');
    expect(line).not.toContain('apikey');
  });

  it('names the read in the thrown error but carries no upstream text', async () => {
    goOnline();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(
      contentOrOfflineSeed('articles.published', async () => {
        throw new Error('relation "lab_articles" does not exist');
      }, () => SEED),
    ).rejects.toThrow(/^articles\.published$/);
  });
});

describe('the locale error boundary', () => {
  const source = readFileSync('src/app/[locale]/error.tsx', 'utf8');

  it('never renders the error message to the reader', () => {
    /* A cold content miss now reaches this boundary. Next does not preserve a
       custom server error class across the client boundary in production — the
       message is replaced by a generic string and only `digest` survives — so
       there is nothing to classify on and nothing safe to print. It renders the
       translated copy and, at most, the digest. */
    expect(source).not.toMatch(/\{\s*error\.message\s*\}/);
    expect(source).not.toMatch(/error instanceof/);
  });
});

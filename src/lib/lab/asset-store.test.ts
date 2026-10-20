import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';

const dev = { on: false };

/** The online ledger: what `lab_assets` holds, and whether reading it fails. */
const ledger = {
  rows: [] as { id: string; state: string }[],
  fails: false,
  states: [] as string[],
};

vi.mock('./dev-store', () => ({ isDevStore: () => dev.on }));

vi.mock('@/lib/supabase/server', () => ({
  contentAdmin: () => {
    if (dev.on) throw new Error('the offline branch must not reach Supabase');
    return {
      from: () => ({
        select: () => ({
          eq: () => ({
            in: async (_col: string, states: string[]) => {
              ledger.states = states;
              return ledger.fails
                ? { data: null, error: { message: 'connection reset' } }
                : { data: ledger.rows.filter((r) => states.includes(r.state)), error: null };
            },
          }),
        }),
      }),
      storage: {
        from: () => ({
          createSignedUrl: async (path: string) => ({
            data: { signedUrl: `https://signed.test/${path}` },
            error: null,
          }),
        }),
      },
    };
  },
  contentRead: () => {
    throw new Error('the offline branch must not reach Supabase');
  },
  controlAdmin: () => {
    throw new Error('assets do not live on the control plane');
  },
  controlRead: () => {
    throw new Error('assets do not live on the control plane');
  },
  hasContentConfig: () => !dev.on,
  hasControlConfig: () => !dev.on,
}));

const { articlePreviews, signedPreview } = await import('./asset-store');

/**
 * The editor offline, which is the mode the whole dev store exists to serve.
 *
 * There is no `lab_assets` table on a laptop, so nothing can be enumerated —
 * and `articlePreviews` returned `{}` because of it. Every image in a locally
 * authored article showed "preview expired" the moment the editor reopened it,
 * while the files sat on disk the whole time, at a path derivable from the ids
 * already in the article's blocks.
 */

const ARTICLE = 'body-ev-vs-flash-ev';
const A = '3f2b9c41-6d5e-4a7b-9c10-2e8f4a6b1d33';
const B = '8a1c0e22-4b7d-4f19-ae03-91d6c5b7f402';

afterEach(() => {
  dev.on = false;
  ledger.rows = [];
  ledger.fails = false;
});

describe('articlePreviews, offline', () => {
  it('derives a preview for every asset the article references', async () => {
    dev.on = true;
    await expect(articlePreviews(ARTICLE, [A, B])).resolves.toEqual({
      previews: {
        [A]: `/lab/${ARTICLE}/${A}/1024.webp`,
        [B]: `/lab/${ARTICLE}/${B}/1024.webp`,
      },
      failed: false,
    });
  });

  it('is empty when the article references nothing', async () => {
    dev.on = true;
    await expect(articlePreviews(ARTICLE, [])).resolves.toEqual({ previews: {}, failed: false });
  });

  it('serves the widest rung, which is what the slot renders', async () => {
    dev.on = true;
    await expect(signedPreview(ARTICLE, A)).resolves.toBe(`/lab/${ARTICLE}/${A}/1024.webp`);
  });

  it('never opens a Supabase client offline', async () => {
    /* The mocked factories throw. If the offline branch reached one, this would
       be a rejection rather than a map. */
    dev.on = true;
    await expect(articlePreviews(ARTICLE, [A])).resolves.toBeTypeOf('object');
  });
});

describe('articlePreviews, online', () => {
  it('says the ledger could not be read, rather than that every image expired', async () => {
    /* `{}` on a read error answered 200, and the editor showed every picture
       as "preview expired" with nothing to say the database was the cause. */
    ledger.fails = true;
    await expect(articlePreviews(ARTICLE, [A])).resolves.toEqual({ previews: {}, failed: true });
  });

  it('signs a referenced cleanup_failed image, whose private copy a failed unpublish kept', async () => {
    ledger.rows = [
      { id: A, state: 'cleanup_failed' },
      { id: B, state: 'cleanup_failed' },
    ];
    const { previews, failed } = await articlePreviews(ARTICLE, [A]);
    expect(failed).toBe(false);
    expect(ledger.states).toContain('cleanup_failed');
    // B is unreferenced: possibly an upload whose own cleanup failed, so no preview.
    expect(Object.keys(previews)).toEqual([A]);
    expect(previews[A]).toBe(`https://signed.test/${ARTICLE}/${A}/1024.webp`);
  });
});

describe('the offline write path', () => {
  const source = readFileSync('src/lib/lab/asset-store.ts', 'utf8');

  it('joins literal segments, so the bundler can see which subtree it touches', () => {
    /* Turbopack traces `process.cwd()` joins statically. Spreading an array of
       segments defeats that — it cannot tell which subtree is reachable, so it
       traces the whole project, `public/` included, into the serverless output.
       The build warns about it; this is what keeps the fix from being undone by
       an innocent-looking refactor back to a constant. */
    expect(source).toMatch(/join\(process\.cwd\(\), 'public', 'lab', relative\)/);
    expect(source).not.toMatch(/join\(process\.cwd\(\), \.\.\./);
  });
});

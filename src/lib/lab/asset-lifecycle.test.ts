import { beforeEach, describe, expect, it, vi } from 'vitest';

import { referencedAssetIds } from './assets';
import { deleteArticleAssets, reconcileArticleAssets, resolveReferencedAssets } from './asset-lifecycle';

/**
 * The public bucket must hold exactly what the public site shows.
 *
 * Both directions of drift are real and only one of them is visible. A picture
 * left public after its article was unpublished stays fetchable by anyone with
 * the URL — for an unannounced camera, that is the leak the private bucket
 * exists to prevent, and nothing on the site would show it. A picture not
 * copied before publication is a broken image, which at least someone notices.
 *
 * So the orderings are asserted, not just the outcomes: a failure at any step
 * has to leave the invisible-but-wrong state rather than the public-and-wrong
 * one.
 */

const ARTICLE = 'body-ev-vs-flash-ev';
const A = '3f2b9c41-6d5e-4a7b-9c10-2e8f4a6b1d33';
const B = '8a1c0e22-4b7d-4f19-ae03-91d6c5b7f402';
const FOREIGN = 'c7d41e90-2a35-4b68-8f1d-5e0937ab46c2';

type Call = { op: string; bucket: string; paths: string[] };

const db = {
  assets: [] as { id: string; state: string }[],
  updates: [] as { ids: string[]; state: string }[],
  deleted: [] as string[],
  copyFails: false,
  removeFails: null as string | null,
};

const calls: Call[] = [];

function bucket(name: string) {
  return {
    copy: async (from: string, to: string) => {
      calls.push({ op: 'copy', bucket: name, paths: [from, to] });
      return db.copyFails ? { error: { message: 'network' } } : { error: null };
    },
    remove: async (paths: string[]) => {
      calls.push({ op: 'remove', bucket: name, paths });
      return db.removeFails === name ? { error: { message: 'network' } } : { error: null };
    },
  };
}

vi.mock('./dev-store', () => ({ isDevStore: () => false }));

vi.mock('@/lib/supabase/server', () => ({
  contentAdmin: () => ({
    from: () => ({
      /* Shaped like the real builder: `select().eq()` is the terminal await,
         `update().in()` and `delete().eq()` are their own chains. */
      select: () => ({
        eq: async () => ({ data: db.assets, error: null }),
      }),
      update: (patch: { state: string }) => ({
        in: async (_col: string, ids: string[]) => {
          db.updates.push({ ids, state: patch.state });
          for (const row of db.assets) if (ids.includes(row.id)) row.state = patch.state;
          return { error: null };
        },
      }),
      delete: () => ({
        eq: async (_col: string, value: string) => {
          db.deleted.push(value);
          return { error: null };
        },
      }),
    }),
    storage: { from: bucket },
  }),
  contentRead: () => {
    throw new Error('lifecycle work is privileged');
  },
  controlAdmin: () => {
    throw new Error('assets do not live on the control plane');
  },
  controlRead: () => {
    throw new Error('assets do not live on the control plane');
  },
  hasContentConfig: () => true,
  hasControlConfig: () => true,
}));

const figure = (assetId: string) => ({ t: 'figure', caption: 'c', assetId });

beforeEach(() => {
  calls.length = 0;
  db.assets = [
    { id: A, state: 'draft' },
    { id: B, state: 'draft' },
  ];
  db.updates = [];
  db.deleted = [];
  db.copyFails = false;
  db.removeFails = null;
});

describe('referencedAssetIds', () => {
  it('deduplicates across figures and comparisons', () => {
    expect(
      referencedAssetIds([
        figure(A),
        figure(A),
        { t: 'compare', beforeAssetId: A, afterAssetId: B },
        { t: 'p', text: 'no asset here' },
        null,
      ]),
    ).toEqual([A, B]);
  });

  it('ignores anything that is not a canonical UUID', () => {
    expect(referencedAssetIds([{ t: 'figure', assetId: 'https://evil.test/x.png' }])).toEqual([]);
  });
});

describe('resolveReferencedAssets', () => {
  it('accepts the article’s own assets', async () => {
    await expect(resolveReferencedAssets(ARTICLE, [figure(A)])).resolves.toEqual({
      ok: true,
      ids: [A],
    });
  });

  it.each(['orphaned', 'cleanup_failed'])('rejects an asset left %s', async (state) => {
    /* The row exists but its objects may not. Copying one fails three calls
       later with a Storage error, which reports `assetSyncFailed` and sends
       whoever reads the log looking for a network fault instead of at a
       half-finished upload. */
    db.assets = [{ id: A, state }];
    await expect(resolveReferencedAssets(ARTICLE, [figure(A)])).resolves.toEqual({
      ok: false,
      error: 'incompleteAsset',
    });
  });

  it('accepts a published asset, because a republish is the ordinary case', async () => {
    db.assets = [{ id: A, state: 'published' }];
    await expect(resolveReferencedAssets(ARTICLE, [figure(A)])).resolves.toEqual({
      ok: true,
      ids: [A],
    });
  });

  it('rejects a UUID the article does not own', async () => {
    /* Copied from another article, this would otherwise publish that article's
       private photography under this one's path. */
    await expect(resolveReferencedAssets(ARTICLE, [figure(FOREIGN)])).resolves.toEqual({
      ok: false,
      error: 'foreignAsset',
    });
  });
});

describe('publishing', () => {
  it('copies every rung into the public bucket, then marks them published', async () => {
    await expect(reconcileArticleAssets(ARTICLE, [figure(A)], 'published')).resolves.toEqual({
      ok: true,
    });
    const copies = calls.filter((c) => c.op === 'copy');
    expect(copies.map((c) => c.paths[0])).toEqual([
      `${ARTICLE}/${A}/320.webp`,
      `${ARTICLE}/${A}/640.webp`,
      `${ARTICLE}/${A}/1024.webp`,
    ]);
    expect(db.updates).toContainEqual({ ids: [A], state: 'published' });
  });

  it('retires an asset the body no longer references', async () => {
    /* Deleting a figure from a published article is the ordinary way an image
       becomes unreferenced. Leaving it public serves a picture the editor
       removed. */
    db.assets = [
      { id: A, state: 'published' },
      { id: B, state: 'published' },
    ];
    await reconcileArticleAssets(ARTICLE, [figure(A)], 'published');
    const removed = calls.filter((c) => c.op === 'remove' && c.bucket === 'lab');
    expect(removed.flatMap((c) => c.paths)).toEqual([
      `${ARTICLE}/${B}/320.webp`,
      `${ARTICLE}/${B}/640.webp`,
      `${ARTICLE}/${B}/1024.webp`,
    ]);
  });

  it('reports a failed copy rather than flipping the article', async () => {
    db.copyFails = true;
    await expect(reconcileArticleAssets(ARTICLE, [figure(A)], 'published')).resolves.toEqual({
      ok: false,
      error: 'assetSyncFailed',
    });
    expect(db.updates).not.toContainEqual({ ids: [A], state: 'published' });
  });

  it('refuses before copying anything when a reference is foreign', async () => {
    await reconcileArticleAssets(ARTICLE, [figure(FOREIGN)], 'published');
    expect(calls).toEqual([]);
  });

  it('refuses before copying anything when a reference is incomplete', async () => {
    db.assets = [{ id: A, state: 'orphaned' }];
    await expect(reconcileArticleAssets(ARTICLE, [figure(A)], 'published')).resolves.toEqual({
      ok: false,
      error: 'incompleteAsset',
    });
    expect(calls).toEqual([]);
  });
});

describe('unpublishing', () => {
  it('removes every public copy and returns the assets to draft', async () => {
    db.assets = [
      { id: A, state: 'published' },
      { id: B, state: 'published' },
    ];
    await expect(reconcileArticleAssets(ARTICLE, [figure(A)], 'draft')).resolves.toEqual({
      ok: true,
    });
    const removed = calls.filter((c) => c.op === 'remove');
    expect(removed).toHaveLength(1);
    expect(removed[0].bucket).toBe('lab');
    expect(removed[0].paths).toHaveLength(6);
    expect(db.updates).toContainEqual({ ids: [A, B], state: 'draft' });
  });

  it('keeps the private variants, so a republish costs no reprocessing', async () => {
    db.assets = [{ id: A, state: 'published' }];
    await reconcileArticleAssets(ARTICLE, [figure(A)], 'draft');
    expect(calls.some((c) => c.bucket === 'lab-drafts')).toBe(false);
  });

  it('marks an asset cleanup_failed when its public copy will not go', async () => {
    db.assets = [{ id: A, state: 'published' }];
    db.removeFails = 'lab';
    await expect(reconcileArticleAssets(ARTICLE, [figure(A)], 'draft')).resolves.toEqual({
      ok: false,
      error: 'assetSyncFailed',
    });
    expect(db.updates).toContainEqual({ ids: [A], state: 'cleanup_failed' });
  });
});

describe('deleting', () => {
  it('empties the public bucket first, then the private one, then the rows', async () => {
    await expect(deleteArticleAssets(ARTICLE)).resolves.toEqual({ ok: true });
    expect(calls.map((c) => `${c.op}:${c.bucket}`)).toEqual(['remove:lab', 'remove:lab-drafts']);
    expect(db.deleted).toEqual([ARTICLE]);
  });

  it('stops before deleting a row when an object will not go', async () => {
    /* The row is the only record of which objects to remove. Deleting it first
       makes them unreachable forever — which is why the foreign key is
       RESTRICT as well. */
    db.removeFails = 'lab-drafts';
    await expect(deleteArticleAssets(ARTICLE)).resolves.toEqual({
      ok: false,
      error: 'assetSyncFailed',
    });
    expect(db.deleted).toEqual([]);
    expect(db.updates).toContainEqual({ ids: [A, B], state: 'cleanup_failed' });
  });

  it('is a no-op for an article with no assets', async () => {
    db.assets = [];
    await expect(deleteArticleAssets(ARTICLE)).resolves.toEqual({ ok: true });
    expect(calls).toEqual([]);
  });
});

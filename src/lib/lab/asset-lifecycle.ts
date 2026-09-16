import 'server-only';
import { contentAdmin } from '@/lib/supabase/server';
import {
  DRAFT_BUCKET,
  PUBLIC_BUCKET,
  assetVariantPaths,
  referencedAssetIds,
} from './assets';
import { isDevStore } from './dev-store';

/**
 * Keeping what is in the public bucket equal to what is on the public site.
 *
 * An article's visibility is a database column; its photography is objects in
 * two buckets. Nothing keeps those in step on its own, and both directions of
 * drift are real:
 *
 * - A picture left in the public bucket after its article was unpublished is
 *   still fetchable by anyone holding the URL. For an unannounced camera that
 *   is the leak the private bucket exists to prevent.
 * - A picture not copied to the public bucket before its article was published
 *   is a broken image on a live page.
 *
 * So the orderings below are chosen so that a failure at any step leaves the
 * *safe* half of the drift, never the leaking one:
 *
 * - **Publishing** copies bytes first, then flips the article. A failed copy
 *   means a private article with some public objects — invisible, and cleaned
 *   up by the next publish.
 * - **Unpublishing** flips the article and invalidates the cache first, then
 *   removes bytes. A failed removal means a private article whose objects are
 *   briefly still fetchable by URL, which is bad; doing it the other way round
 *   means a *published* article with no images, which is bad and visible to
 *   everybody. The failed asset is marked so the cleanup view lists it.
 * - **Deleting** clears both buckets before it touches a row. The restrictive
 *   foreign key on `lab_assets` enforces this even if the code forgets.
 */

export type LifecycleFailure = 'foreignAsset' | 'incompleteAsset' | 'assetSyncFailed';

export type LifecycleResult = { ok: true } | { ok: false; error: LifecycleFailure };

type AssetRow = { id: string; state: string };

async function ownedAssets(articleId: string): Promise<AssetRow[]> {
  const { data, error } = await contentAdmin()
    .from('lab_assets')
    .select('id, state')
    .eq('article_id', articleId);
  if (error) throw new Error(`lab_assets: ${error.message}`);
  return (data ?? []) as AssetRow[];
}

async function setState(ids: readonly string[], state: string): Promise<boolean> {
  if (ids.length === 0) return true;
  const { error } = await contentAdmin()
    .from('lab_assets')
    .update({ state })
    .in('id', [...ids]);
  if (error) {
    console.error(`[content] lab_assets -> ${state} failed:`, error.message);
    return false;
  }
  return true;
}

/**
 * Every asset the body references, checked against what the article owns.
 *
 * The check is ownership, not existence, and the difference matters: a UUID
 * copied from another article would otherwise publish that article's private
 * photography under this one's path. Publishing a path inferred from an unowned
 * UUID is the one thing this module must never do.
 */
export async function resolveReferencedAssets(
  articleId: string,
  blocks: readonly unknown[],
): Promise<{ ok: true; ids: string[] } | { ok: false; error: 'foreignAsset' | 'incompleteAsset' }> {
  const referenced = referencedAssetIds(blocks);
  if (referenced.length === 0) return { ok: true, ids: [] };

  const owned = new Map((await ownedAssets(articleId)).map((r) => [r.id, r.state]));

  const foreign = referenced.filter((id) => !owned.has(id));
  if (foreign.length > 0) {
    console.error(`[content] article ${articleId} references assets it does not own`);
    return { ok: false, error: 'foreignAsset' };
  }

  /* `orphaned` and `cleanup_failed` mean the row exists but its objects may
     not. Copying one produces a Storage error three calls later and reports
     `assetSyncFailed`, which sends whoever is reading the log looking for a
     network fault instead of at a half-finished upload. Refuse it by name,
     here, where the state is in hand. */
  const incomplete = referenced.filter((id) => {
    const state = owned.get(id);
    return state !== 'draft' && state !== 'published';
  });
  if (incomplete.length > 0) {
    console.error(
      `[content] article ${articleId} references incomplete assets: ${incomplete.join(', ')}`,
    );
    return { ok: false, error: 'incompleteAsset' };
  }

  return { ok: true, ids: referenced };
}

/** Copy every rung of these assets into the public bucket and mark them. */
async function publishAssets(articleId: string, ids: readonly string[]): Promise<boolean> {
  for (const id of ids) {
    for (const path of assetVariantPaths(articleId, id)) {
      const { error } = await contentAdmin()
        .storage.from(DRAFT_BUCKET)
        .copy(path, path, { destinationBucket: PUBLIC_BUCKET });
      /* A republish copies over an object that is already there. That is the
         normal path, not an error, so only a genuine failure aborts. */
      if (error && !/already exists|duplicate|resource exists/i.test(error.message)) {
        console.error('[content] publish copy failed:', error.message);
        return false;
      }
    }
  }
  return setState(ids, 'published');
}

/**
 * Remove the public copies and return the assets to draft.
 *
 * The private variants stay. That is what makes a republish free — no
 * reprocessing, no re-upload — and it is why the editor's preview can always
 * come from the private bucket whatever the article's status is.
 */
async function retireAssets(articleId: string, ids: readonly string[]): Promise<boolean> {
  if (ids.length === 0) return true;
  const paths = ids.flatMap((id) => assetVariantPaths(articleId, id));
  const { error } = await contentAdmin().storage.from(PUBLIC_BUCKET).remove(paths);
  if (error) {
    console.error('[content] public asset removal failed:', error.message);
    await setState(ids, 'cleanup_failed');
    return false;
  }
  return setState(ids, 'draft');
}

/**
 * Bring the buckets in line with what the article is about to become.
 *
 * Called before the status change when publishing and after it when
 * unpublishing — see the header. `nextStatus` is what the article will be, not
 * what it is.
 */
export async function reconcileArticleAssets(
  articleId: string,
  blocks: readonly unknown[],
  nextStatus: 'draft' | 'published',
): Promise<LifecycleResult> {
  if (isDevStore()) return { ok: true };

  const resolved = await resolveReferencedAssets(articleId, blocks);
  if (!resolved.ok) return resolved;

  const owned = await ownedAssets(articleId);
  const referenced = new Set(resolved.ids);

  /* Anything currently public that the body no longer references has to come
     back out, whatever the article's status is. Deleting a figure from a
     published article is the ordinary way an image becomes unreferenced, and
     leaving it public would mean a picture the editor removed is still served. */
  const strandedPublic = owned
    .filter((row) => row.state === 'published' && !referenced.has(row.id))
    .map((row) => row.id);

  if (nextStatus === 'published') {
    if (!(await publishAssets(articleId, resolved.ids))) {
      return { ok: false, error: 'assetSyncFailed' };
    }
    if (!(await retireAssets(articleId, strandedPublic))) {
      return { ok: false, error: 'assetSyncFailed' };
    }
    return { ok: true };
  }

  /* Unpublishing: everything public comes out, referenced or not. */
  const allPublic = owned.filter((row) => row.state === 'published').map((row) => row.id);
  if (!(await retireAssets(articleId, allPublic))) {
    return { ok: false, error: 'assetSyncFailed' };
  }
  return { ok: true };
}

/**
 * Empty both buckets, then the ledger, then the article — in that order.
 *
 * The order is enforced twice on purpose. Here, because objects are not
 * transactional and a row deleted first takes with it the only record of which
 * objects to remove; and in the schema, by `on delete restrict`, because a
 * future caller that forgets should get a foreign-key violation rather than a
 * silently unreachable bucket.
 */
export async function deleteArticleAssets(articleId: string): Promise<LifecycleResult> {
  if (isDevStore()) return { ok: true };

  const owned = await ownedAssets(articleId);
  if (owned.length === 0) return { ok: true };

  const paths = owned.flatMap((row) => assetVariantPaths(articleId, row.id));

  /* The public bucket first: it is the one a reader can reach. `remove` on a
     path that is not there is not an error, so a draft article's assets — which
     were never copied out — pass through this harmlessly. */
  const pub = await contentAdmin().storage.from(PUBLIC_BUCKET).remove(paths);
  if (pub.error) {
    console.error('[content] public delete failed:', pub.error.message);
    await setState(owned.map((r) => r.id), 'cleanup_failed');
    return { ok: false, error: 'assetSyncFailed' };
  }

  const drafts = await contentAdmin().storage.from(DRAFT_BUCKET).remove(paths);
  if (drafts.error) {
    console.error('[content] draft delete failed:', drafts.error.message);
    await setState(owned.map((r) => r.id), 'cleanup_failed');
    return { ok: false, error: 'assetSyncFailed' };
  }

  const { error } = await contentAdmin().from('lab_assets').delete().eq('article_id', articleId);
  if (error) {
    console.error('[content] lab_assets delete failed:', error.message);
    return { ok: false, error: 'assetSyncFailed' };
  }
  return { ok: true };
}

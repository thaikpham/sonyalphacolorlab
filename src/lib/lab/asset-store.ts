import 'server-only';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { contentAdmin } from '@/lib/supabase/server';
import {
  DEFAULT_RUNG,
  DRAFT_BUCKET,
  LAB_ASSET_WIDTHS,
  PUBLIC_BUCKET,
  assetVariantPath,
  assetVariantPaths,
} from './assets';
import { isDevStore } from './dev-store';
import type { ProcessedLabImage } from './image-process';

/**
 * Putting an uploaded picture somewhere, without ever half-putting it.
 *
 * Storage objects and database rows do not share a transaction, which is the
 * only interesting thing about this file. Two orderings are possible and both
 * lose:
 *
 * - Objects first, then the row. A failure leaves bytes in a bucket that
 *   nothing references, in a bucket nobody browses, billed monthly forever.
 * - Row first, then the objects. A failure leaves a row pointing at nothing,
 *   and an article that references it renders a broken image.
 *
 * So it writes the row first *and says so*: the row is inserted as `orphaned`,
 * meaning "this may not have bytes yet". Only once every variant has uploaded
 * does it become `draft`. Nothing is ever in an unlabelled state, and the two
 * failure modes have names an admin cleanup view can list — `orphaned` when the
 * compensating delete worked, `cleanup_failed` when even that did not.
 *
 * Everything lands in the **private** bucket. A draft article's photography is
 * not public, and an editor previewing it gets a signed URL that expires. The
 * public bucket is written only by the publish step, from these same bytes.
 */

/** Long enough to edit a block, short enough that a copied link goes stale. */
export const PREVIEW_TTL_SECONDS = 600;

export type UploadedAsset = { assetId: string; previewUrl: string };

export type AssetUploadFailure = 'articleNotFound' | 'uploadFailed';

export type AssetUploadResult =
  | { ok: true; asset: UploadedAsset }
  | { ok: false; error: AssetUploadFailure };

/*
 * The offline write path is built from literal segments on purpose.
 *
 * Turbopack traces `process.cwd()` joins statically to decide what to bundle.
 * Spreading an array of segments into `join` defeats that: it cannot tell which
 * subtree is reachable, so it conservatively traces **the whole project** — all
 * source files and the entire `public/` folder — into the serverless output.
 * The build says so, and the cost is a deployment that is tens of megabytes
 * larger for a branch that only ever runs on a laptop.
 */

async function articleExists(articleId: string): Promise<boolean> {
  const { data, error } = await contentAdmin()
    .from('lab_articles')
    .select('id')
    .eq('id', articleId)
    .maybeSingle();
  if (error) throw new Error(`lab_articles: ${error.message}`);
  return data !== null;
}

/**
 * Remove exactly the paths this request created, and nothing else.
 *
 * Explicit paths rather than a prefix delete. A prefix is one typo away from
 * removing another asset's variants, and this runs on the failure path — the
 * moment when a second bug is least likely to be noticed.
 */
async function removeUploaded(paths: readonly string[]): Promise<boolean> {
  if (paths.length === 0) return true;
  const { error } = await contentAdmin().storage.from(DRAFT_BUCKET).remove([...paths]);
  if (error) {
    console.error('[content] draft asset cleanup failed:', error.message);
    return false;
  }
  return true;
}

async function markState(assetId: string, state: string): Promise<void> {
  const { error } = await contentAdmin().from('lab_assets').update({ state }).eq('id', assetId);
  if (error) console.error(`[content] could not mark asset ${state}:`, error.message);
}

/**
 * Store one processed image against a draft article.
 *
 * `assetId` is generated here rather than accepted from the caller: it becomes
 * a Storage path segment and an ownership key, and a client-supplied one would
 * be both a path-traversal surface and a way to claim another article's asset.
 */
export async function uploadDraftAsset(
  articleId: string,
  image: ProcessedLabImage,
  editorEmail: string,
): Promise<AssetUploadResult> {
  const assetId = crypto.randomUUID();

  if (isDevStore()) return uploadLocally(articleId, assetId, image);

  if (!(await articleExists(articleId))) return { ok: false, error: 'articleNotFound' };

  /* `storage_path` is unique, so the row claims all three paths by claiming the
     widest one. Inserted as `orphaned`: true until the objects land. */
  const { error: insertError } = await contentAdmin()
    .from('lab_assets')
    .insert({
      id: assetId,
      article_id: articleId,
      storage_path: assetVariantPath(articleId, assetId, DEFAULT_RUNG),
      mime_type: 'image/webp',
      width: image.width,
      height: image.height,
      byte_size: image.byteSize,
      animated: false,
      state: 'orphaned',
      updated_by: editorEmail,
    });

  if (insertError) {
    console.error('[content] lab_assets insert failed:', insertError.message);
    return { ok: false, error: 'uploadFailed' };
  }

  const written: string[] = [];
  for (const variant of image.variants) {
    const path = assetVariantPath(articleId, assetId, variant.rung);
    const { error } = await contentAdmin()
      .storage.from(DRAFT_BUCKET)
      .upload(path, variant.bytes, {
        contentType: 'image/webp',
        /* Generated names never collide, so an upsert could only ever mask a
           bug — and silently replacing an object another row claims is the
           worst shape that bug could take. */
        upsert: false,
        cacheControl: '31536000',
      });

    if (error) {
      console.error('[content] draft variant upload failed:', error.message);
      const cleaned = await removeUploaded(written);
      await markState(assetId, cleaned ? 'orphaned' : 'cleanup_failed');
      return { ok: false, error: 'uploadFailed' };
    }
    written.push(path);
  }

  const { error: stateError } = await contentAdmin()
    .from('lab_assets')
    .update({ state: 'draft', updated_by: editorEmail })
    .eq('id', assetId);

  if (stateError) {
    /* The bytes are there and the row says they might not be. That is the safe
       direction of wrong — the cleanup view lists it, and nothing publishes an
       asset it believes is orphaned. */
    console.error('[content] lab_assets state update failed:', stateError.message);
    return { ok: false, error: 'uploadFailed' };
  }

  const previewUrl = await signedPreview(articleId, assetId);
  if (!previewUrl) return { ok: false, error: 'uploadFailed' };

  return { ok: true, asset: { assetId, previewUrl } };
}

/**
 * A short-lived URL for the private copy.
 *
 * The editor is previewing an unpublished photograph. A public URL would make
 * it addressable by anyone who guessed the path, which for a draft comparison
 * of an unannounced camera is exactly the leak the private bucket exists to
 * prevent.
 */
export async function signedPreview(
  articleId: string,
  assetId: string,
): Promise<string | null> {
  if (isDevStore()) return `/lab/${assetVariantPath(articleId, assetId, DEFAULT_RUNG)}`;

  const { data, error } = await contentAdmin()
    .storage.from(DRAFT_BUCKET)
    .createSignedUrl(assetVariantPath(articleId, assetId, DEFAULT_RUNG), PREVIEW_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    console.error('[content] preview signing failed:', error?.message ?? 'no url');
    return null;
  }
  return data.signedUrl;
}

/**
 * Every asset an article owns, as an id → preview map for the editor.
 *
 * Published assets are signed from the private bucket too. The private copies
 * are retained through publication precisely so this stays uniform — the editor
 * never has to care which bucket a picture is currently in, and unpublishing
 * costs no reprocessing.
 *
 * `referenced` is what makes the offline branch work. There is no `lab_assets`
 * table on a laptop, so nothing can be enumerated; the article's own blocks are
 * the only record of which assets exist, and the files sit at a path derived
 * from the ids. Without it this returned `{}` offline, and every image in a
 * locally-authored article showed "preview expired" the moment the editor
 * reopened it — while the files were on disk the whole time.
 */
export async function articlePreviews(
  articleId: string,
  referenced: readonly string[] = [],
): Promise<Record<string, string>> {
  if (isDevStore()) {
    const entries = referenced.map(
      (id) => [id, `/lab/${assetVariantPath(articleId, id, DEFAULT_RUNG)}`] as const,
    );
    return Object.fromEntries(entries);
  }

  const { data, error } = await contentAdmin()
    .from('lab_assets')
    .select('id, state')
    .eq('article_id', articleId)
    .in('state', ['draft', 'published']);

  if (error) {
    console.error('[content] asset list failed:', error.message);
    return {};
  }

  const entries = await Promise.all(
    (data ?? []).map(async (row) => {
      const url = await signedPreview(articleId, row.id as string);
      return url ? ([row.id as string, url] as const) : null;
    }),
  );
  return Object.fromEntries(entries.filter((e): e is readonly [string, string] => e !== null));
}

/**
 * The offline branch: the same three rungs, on disk.
 *
 * It writes the processed variants, not the original — so an article authored
 * on a laptop renders through exactly the same loader path as a deployed one,
 * and there is no offline-only shape for a renderer to special-case. The
 * directory is gitignored: these are one developer's test images.
 */
async function uploadLocally(
  articleId: string,
  assetId: string,
  image: ProcessedLabImage,
): Promise<AssetUploadResult> {
  try {
    for (const variant of image.variants) {
      const relative = assetVariantPath(articleId, assetId, variant.rung);
      const target = join(process.cwd(), 'public', 'lab', relative);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, variant.bytes);
    }
    return {
      ok: true,
      asset: {
        assetId,
        previewUrl: `/lab/${assetVariantPath(articleId, assetId, DEFAULT_RUNG)}`,
      },
    };
  } catch (err) {
    console.error('[lab] local asset write failed:', err);
    return { ok: false, error: 'uploadFailed' };
  }
}

/** Re-exported so the lifecycle module and the tests share one path vocabulary. */
export { LAB_ASSET_WIDTHS, DRAFT_BUCKET, PUBLIC_BUCKET, assetVariantPaths };

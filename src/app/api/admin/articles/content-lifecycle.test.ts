import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The order the article route does things in, which is the whole safety story.
 *
 * An article's visibility is a column; its photography is objects in two
 * buckets, and nothing keeps them in step on its own. Both orderings below were
 * chosen so that a failure leaves the invisible-but-wrong state rather than the
 * public-and-wrong one, and neither is obvious from reading the handler
 * top-to-bottom — so they are pinned here.
 */

const ROUTE = 'src/app/api/admin/articles/[id]/route.ts';
const source = readFileSync(ROUTE, 'utf8');

/** The slice of the file between one handler and the next. */
function handler(verb: string): string {
  const start = source.indexOf(`export async function ${verb}(`);
  expect(start).toBeGreaterThan(-1);
  const next = source.slice(start + 1).search(/export async function /);
  return next === -1 ? source.slice(start) : source.slice(start, start + 1 + next);
}

describe('PATCH', () => {
  const body = handler('PATCH');

  it('copies the bytes public before the article becomes public', () => {
    const copy = body.indexOf("'published')");
    const flip = body.indexOf('updateArticleRecord(');
    expect(copy).toBeGreaterThan(-1);
    expect(copy).toBeLessThan(flip);
  });

  it('treats a bad asset reference as a bad request and only an outage as 502', () => {
    /* A UUID copied from another article, or one whose upload never finished,
       is something the editor can fix — 422. Only a Storage or database failure
       is a 502. Collapsing the two would have an editor retrying a save that
       will never work. */
    expect(body).toMatch(/synced\.error === 'assetSyncFailed' \? 502 : 422/);
  });

  it('makes the article private and clears the cache before removing objects', () => {
    const flip = body.indexOf('updateArticleRecord(');
    const invalidate = body.indexOf('revalidateTag(LAB_TAG, IMMEDIATE)');
    const retire = body.lastIndexOf("reconcileArticleAssets(");
    expect(flip).toBeLessThan(invalidate);
    expect(invalidate).toBeLessThan(retire);
  });

  it('never invalidates on a failed save', () => {
    const failure = body.lastIndexOf("{ error: 'saveFailed' }");
    expect(failure).toBeLessThan(body.indexOf('revalidateTag(LAB_TAG, IMMEDIATE)'));
  });
});

describe('DELETE', () => {
  const body = handler('DELETE');

  it('empties the buckets before it deletes the row that names them', () => {
    /* The asset row is the only record of which objects belong to the article.
       Deleting it first makes them unreachable forever — which is also why the
       foreign key is RESTRICT rather than CASCADE. */
    const clean = body.indexOf('deleteArticleAssets(');
    const remove = body.indexOf('deleteArticleRecord(');
    expect(clean).toBeGreaterThan(-1);
    expect(clean).toBeLessThan(remove);
  });

  it('stops at a cleanup failure instead of deleting anyway', () => {
    expect(body).toMatch(/if \(!cleaned\.ok\)[\s\S]{0,120}status: 502/);
  });
});

describe('GET', () => {
  const body = handler('GET');

  it('is not frozen, because reading is not writing', () => {
    /* The freeze exists to hold the content tables still during a cutover
       delta. Blocking reads with it would make the editor look broken for the
       duration, and would tempt somebody to skip the freeze. */
    expect(body).not.toContain('contentAdminWritesFrozen');
  });

  it('hands back signed previews rather than public URLs', () => {
    expect(body).toMatch(/articlePreviews\(id, referencedAssetIds\(article\.blocks\)\)/);
  });
});

describe('the upload route', () => {
  const upload = readFileSync('src/app/api/admin/articles/upload/route.ts', 'utf8');

  it('never writes to the public bucket', () => {
    /* A draft article's photography is not public. The publish step is the
       only thing that puts bytes in `lab`. */
    expect(upload).not.toMatch(/from\('lab'\)/);
    expect(upload).not.toContain('getPublicUrl');
  });

  it('requires an owning article before it will accept bytes', () => {
    const owner = upload.indexOf("'saveBeforeUpload'");
    const read = upload.indexOf('arrayBuffer()');
    expect(owner).toBeGreaterThan(-1);
    expect(owner).toBeLessThan(read);
  });

  it('processes every upload rather than storing what arrived', () => {
    expect(upload).toContain('processLabImage');
  });

  it('returns no public URL and no editor address', () => {
    expect(upload).not.toMatch(/publicUrl/);
    expect(upload).not.toMatch(/email:/);
  });
});

describe('the editor', () => {
  const source = readFileSync('src/components/lab/admin/article-admin.tsx', 'utf8');

  it('reloads the record when the parser dropped a block', () => {
    /* A dropped block is gone from the row the moment the save returns, but it
       is still on screen — and `dirty` is false, so nothing prompts the editor
       to reconcile them. Left alone they keep editing blocks that no longer
       exist, and the next save drops them again. */
    expect(source).toMatch(/if \(data\.dropped\)[\s\S]{0,400}openArticle\(savedId\)/);
  });

  it('never persists a signed preview into a block', () => {
    /* A signed URL in a `jsonb` column is a credential-bearing string in the
       article body and a dead link an hour later. */
    expect(source).not.toMatch(/previewUrl[^\n]*blocks/);
    expect(source).toMatch(/setPreviews\(/);
  });

  it('will not upload against an article that has no row yet', () => {
    expect(source).toMatch(/if \(!articleId\)[\s\S]{0,200}saveBeforeUpload/);
    expect(source).toMatch(/canUpload=\{articleId !== null\}/);
  });
});

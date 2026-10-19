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

  it('retires what a published body dropped only after the row is written', () => {
    /* Before, the publish step removed a deleted figure's public copy and then
       wrote the row. A failed write left the live page — still the old
       version, still naming that figure — with a broken image. */
    const flip = body.indexOf('updateArticleRecord(');
    const invalidate = body.indexOf('revalidateTag(LAB_TAG, IMMEDIATE)');
    const retire = body.indexOf('retireUnreferencedAssets(');
    expect(retire).toBeGreaterThan(-1);
    expect(flip).toBeLessThan(retire);
    expect(invalidate).toBeLessThan(retire);
    // A failure answers with the stored version, as the draft path does.
    expect(body.slice(retire)).toMatch(/if \(!synced\.ok\)[\s\S]{0,160}\.\.\.stored \}, \{ status: 502 \}/);
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

  it('rebuilds the draft from the stored row the save answered with', () => {
    /* A dropped block is gone from the row the moment the save returns, but it
       used to stay on screen — and `dirty` was false, so nothing prompted the
       editor to reconcile them. The same held for refused metadata and for
       text the parser cut. The answer now carries what was stored, and the
       draft is rebuilt from it (`afterSave`, executed in article-draft.test). */
    expect(source).toMatch(/setDraft\(\(d\) => afterSave\(d, sent, stored\)\)/);
    expect(source).toMatch(/data\.dropped\s*\?\s*t\('savedWithDropped'/);
    expect(source).toMatch(/t\('savedWithDroppedMeta'/);
  });

  it('never persists a signed preview into a block', () => {
    /* A signed URL in a `jsonb` column is a credential-bearing string in the
       article body and a dead link an hour later. */
    expect(source).not.toMatch(/previewUrl[^\n]*blocks/);
    expect(source).toMatch(/setPreviews\(/);
  });

  it('saves a published article without unpublishing it', () => {
    /* Both buttons used to send 'draft' on a live article: fixing a typo took
       the page down for readers and pulled its images out of the public
       bucket, under a toast that said only "Saved." */
    expect(source).not.toMatch(/save\('draft'\)/);
    expect(source).toMatch(/onClick=\{\(\) => void save\(draft\.status\)\}/);
  });

  it('names the version it opened on every save', () => {
    /* Without it the route's 409 never fires: a second tab's save silently
       reverted the first, and both said "Saved". */
    const draft = readFileSync('src/components/lab/admin/article-draft.ts', 'utf8');
    expect(source).toMatch(/savePayload\(sent, nextStatus\)/);
    expect(draft).toMatch(/expectedUpdatedAt: d\.version/);
    expect(draft).toMatch(/version: a\.updatedAt/);
  });

  it('will not upload against an article that has no row yet', () => {
    expect(source).toMatch(/if \(!articleId\)[\s\S]{0,200}saveBeforeUpload/);
    expect(source).toMatch(/canUpload=\{articleId !== null\}/);
  });
});

describe('PATCH — kinds and references', () => {
  const body = handler('PATCH');

  it('refuses to move a published page between /blog and /learn', () => {
    /* Changing kind changes the URL. On a draft that costs nothing; on a
       published page it breaks every link already shared, so the editor has
       to unpublish first. */
    expect(body).toMatch(
      /existing\.status === 'published' && existing\.kind !== write\.article\.kind[\s\S]{0,120}kindLocked[\s\S]{0,40}status: 409/,
    );
    expect(body.indexOf("'kindLocked'")).toBeLessThan(body.indexOf('updateArticleRecord('));
  });

  it('applies the publish rules for the page kind, not the blog rules to everything', () => {
    expect(body).toContain('validateForPublish(write.article)');
    expect(source).not.toContain('validateArticleShape(');
  });

  it('refuses to publish when the links could not be checked, before anything is written', () => {
    const refused = body.indexOf("'referenceCheckFailed'");
    expect(refused).toBeGreaterThan(-1);
    expect(refused).toBeLessThan(body.indexOf("reconcileArticleAssets(id, write.article.blocks, 'published')"));
    expect(refused).toBeLessThan(body.indexOf('updateArticleRecord('));
  });
});

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_RUNG,
  DRAFT_BUCKET,
  LAB_ASSET_WIDTHS,
  PUBLIC_BUCKET,
  assetVariantPath,
  assetVariantPaths,
  isAssetId,
  parseAssetId,
  referencedAssetIds,
} from './assets';

/**
 * A picture is named by a UUID, and that is the whole point.
 *
 * A stored Storage URL bakes a project reference into an article's body, so
 * this migration — moving the content tables to a second Supabase project —
 * would have meant rewriting every embedded image in every article. A data
 * migration caused entirely by a rendering convenience.
 *
 * These strings also become Storage path segments and ownership keys, which is
 * why the pattern is strict rather than "looks like a UUID": a loose one is a
 * path-traversal surface, and a near-miss turns a typo into a lookup failure
 * instead of a refusal at the boundary.
 */

const ASSET = '3f2b9c41-6d5e-4a7b-9c10-2e8f4a6b1d33';
const ARTICLE = 'body-ev-vs-flash-ev';

describe('isAssetId', () => {
  it('accepts the canonical form', () => {
    expect(isAssetId(ASSET)).toBe(true);
    expect(isAssetId(crypto.randomUUID())).toBe(true);
  });

  it.each([
    ['a truncated UUID', '3f2b9c41-6d5e-4a7b-9c10-2e8f4a6b1d3'],
    ['a nil UUID, whose version nibble is zero', '00000000-0000-0000-0000-000000000000'],
    ['a path traversal', '../../../etc/passwd'],
    ['a Storage URL', 'https://x.supabase.co/storage/v1/object/public/lab/a.webp'],
    ['a UUID with a path glued on', `${ASSET}/../other`],
    ['a number', 42],
    ['nothing', undefined],
  ])('refuses %s', (_label, value) => {
    expect(isAssetId(value)).toBe(false);
    expect(parseAssetId(value)).toBeUndefined();
  });

  it('folds case, because the value becomes a path segment', () => {
    expect(parseAssetId(ASSET.toUpperCase())).toBe(ASSET);
  });
});

describe('paths', () => {
  it('names the article and the asset, then the rung', () => {
    expect(assetVariantPath(ARTICLE, ASSET, 640)).toBe(`${ARTICLE}/${ASSET}/640.webp`);
  });

  it('produces exactly the three rungs, in order', () => {
    expect(assetVariantPaths(ARTICLE, ASSET)).toEqual([
      `${ARTICLE}/${ASSET}/320.webp`,
      `${ARTICLE}/${ASSET}/640.webp`,
      `${ARTICLE}/${ASSET}/1024.webp`,
    ]);
    expect(LAB_ASSET_WIDTHS).toEqual([320, 640, 1024]);
    expect(DEFAULT_RUNG).toBe(1024);
  });

  it('uses the same path in both buckets, which is what makes publishing a copy', () => {
    /* Publishing copies an object from the private bucket to the public one at
       the identical key. Nothing is renamed, so the row does not change and
       unpublishing needs no recomputation. */
    expect(DRAFT_BUCKET).toBe('lab-drafts');
    expect(PUBLIC_BUCKET).toBe('lab');
  });
});

describe('referencedAssetIds', () => {
  it('collects figures and both halves of a comparison, deduplicated', () => {
    const other = '8a1c0e22-4b7d-4f19-ae03-91d6c5b7f402';
    expect(
      referencedAssetIds([
        { t: 'figure', assetId: ASSET },
        { t: 'compare', beforeAssetId: ASSET, afterAssetId: other },
        { t: 'p', text: 'prose' },
      ]),
    ).toEqual([ASSET, other]);
  });

  it('reads the body rather than the asset table', () => {
    /* The article body is the authority on what the article shows. A row
       nothing references is exactly what `orphaned` means, and asking the
       table instead would publish bytes nobody will fetch. */
    expect(referencedAssetIds([])).toEqual([]);
  });
});

describe('the URL builder', () => {
  const source = readFileSync('src/lib/lab/media.ts', 'utf8');

  it('is the only module that knows where an article picture is hosted', () => {
    expect(source).toContain('NEXT_PUBLIC_CONTENT_SUPABASE_URL');
    /* The control project serves no images. Naming it here would be the same
       coupling the UUID removed, one layer up. */
    expect(source).not.toContain('NEXT_PUBLIC_AUTH_SUPABASE_URL');
    expect(source).not.toContain('NEXT_PUBLIC_SUPABASE_URL');
  });

  it('reads the variable as a literal, so Next can inline it for the browser', () => {
    /* A dynamic `env[name]` lookup is not inlined into a client bundle, and
       this module is imported by a client component. */
    expect(source).toMatch(/process\.env\.NEXT_PUBLIC_CONTENT_SUPABASE_URL/);
  });

  it('builds a public object path and never a signed one', () => {
    expect(source).toContain('/storage/v1/object/public/');
    expect(source).not.toContain('/object/sign/');
  });
});

describe('the host allowlist', () => {
  const config = readFileSync('next.config.ts', 'utf8');
  const layout = readFileSync('src/app/[locale]/layout.tsx', 'utf8');

  it('names the content project and nothing else from Supabase', () => {
    expect(config).toContain('NEXT_PUBLIC_CONTENT_SUPABASE_URL');
    expect(config).not.toContain('NEXT_PUBLIC_SUPABASE_URL');
    expect(config).toContain("pathname: '/storage/v1/object/public/**'");
  });

  it('no longer hard-codes the control project anywhere in the page head', () => {
    /* It was preconnected on every public page. That warmed a connection
       nobody used — the control project serves no images — and published which
       project holds the site's Auth. */
    expect(layout).not.toContain('nqeedlgzaewccqztqvik');
  });

  it('preconnects the content origin only when one is configured', () => {
    expect(layout).toMatch(/contentOrigin \? \(/);
  });
});

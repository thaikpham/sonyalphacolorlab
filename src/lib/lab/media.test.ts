import { afterEach, describe, expect, it, vi } from 'vitest';

import { assetUrl } from './media';

/**
 * Where a picture is fetched from, in both configurations.
 *
 * The doc and the return type once said `undefined` when no content project
 * was configured, while the code returned the offline path; two renderers
 * guarded a value that could not occur. These pin what it actually does.
 */

const ARTICLE = 'body-ev-vs-flash-ev';
const ASSET = '3f2b9c41-6d5e-4a7b-9c10-2e8f4a6b1d33';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('assetUrl', () => {
  it('names the public bucket of the content project when one is configured', () => {
    vi.stubEnv('NEXT_PUBLIC_CONTENT_SUPABASE_URL', 'https://content.supabase.test/');
    expect(assetUrl(ARTICLE, ASSET)).toBe(
      `https://content.supabase.test/storage/v1/object/public/lab/${ARTICLE}/${ASSET}/1024.webp`,
    );
  });

  it('falls back to the offline copy under public/lab, never to nothing', () => {
    vi.stubEnv('NEXT_PUBLIC_CONTENT_SUPABASE_URL', '');
    expect(assetUrl(ARTICLE, ASSET, 320)).toBe(`/lab/${ARTICLE}/${ASSET}/320.webp`);
  });
});

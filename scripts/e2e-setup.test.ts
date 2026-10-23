import type { Page } from '@playwright/test';
import { describe, expect, it } from 'vitest';

import { resolve } from '../e2e/setup';

/**
 * `resolve()`'s own regression case: articles and knowledge pages are
 * authored Vietnamese-bodied on both locales (ADR 0004) and indexed ONLY at
 * their `/vi/...` canonical URL, never at the bare path — unlike recipes,
 * cameras and audio, which the sitemap lists bilingually. A fixed id missing
 * its own `/vi/blog/<id>` entry here is exactly the bug that let three
 * published articles resolve to null and skip silently.
 *
 * `setup.ts` caches the sitemap fetch in a module-level variable, so one fake
 * XML answers every case in this file — it is read once per process.
 */
const XML = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>http://localhost:3100/recipe/a</loc></url>
  <url><loc>http://localhost:3100/vi/recipe/a</loc></url>
  <url><loc>http://localhost:3100/blog/setup</loc></url>
  <url><loc>http://localhost:3100/vi/blog/setup</loc></url>
  <url><loc>http://localhost:3100/vi/blog/x</loc></url>
  <url><loc>http://localhost:3100/learn/glossary</loc></url>
  <url><loc>http://localhost:3100/vi/learn/glossary</loc></url>
</urlset>`;

const page = {
  request: { get: async () => ({ text: async () => XML }) },
} as unknown as Page;

describe('resolve()', () => {
  it('resolves a recipe id from its bare sitemap entry', async () => {
    expect(await resolve(page, '/recipe/:recipe')).toBe('/recipe/a');
  });

  it('resolves the same recipe id into a /vi template', async () => {
    expect(await resolve(page, '/vi/recipe/:recipe')).toBe('/vi/recipe/a');
  });

  it('resolves an article id off its /vi canonical entry into the bare template', async () => {
    expect(await resolve(page, '/blog/:article')).toBe('/blog/x');
  });

  it('resolves an article id off its /vi canonical entry into the /vi edit template', async () => {
    expect(await resolve(page, '/vi/blog/:article/edit')).toBe('/vi/blog/x/edit');
  });

  it('returns null when the sitemap has no instance under the prefix', async () => {
    expect(await resolve(page, '/learn/:knowledge')).toBeNull();
  });

  it('leaves a path with no placeholder unchanged', async () => {
    expect(await resolve(page, '/blog/setup')).toBe('/blog/setup');
  });
});

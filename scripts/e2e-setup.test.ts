import type { Page } from '@playwright/test';
import { describe, expect, it, vi } from 'vitest';

import { resolve } from '../e2e/setup';

/**
 * `resolve()`'s own regression case: articles and knowledge pages are
 * authored Vietnamese-bodied on both locales (ADR 0004) and indexed ONLY at
 * their `/vi/...` canonical URL, never at the bare path — unlike recipes,
 * cameras and audio, which the sitemap lists bilingually. A fixed id missing
 * its own `/vi/blog/<id>` entry here is exactly the bug that let three
 * published articles resolve to null and skip silently.
 *
 * The recipes are listed `b` before `a` on purpose: the sitemap's order is
 * whatever the data source returned (the live table's, unordered), so the
 * instance must not depend on it.
 *
 * `setup.ts` caches the sitemap fetch in a module-level variable, so one fake
 * XML answers every case in the first block — it is read once per process.
 * The failure cases each load a fresh copy of the module (`vi.resetModules`)
 * so their own sitemap is the one read.
 */
const XML = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>http://localhost:3100/colorlab</loc></url>
  <url><loc>http://localhost:3100/vi/colorlab</loc></url>
  <url><loc>http://localhost:3100/colorlab/travel</loc></url>
  <url><loc>http://localhost:3100/vi/colorlab/travel</loc></url>
  <url><loc>http://localhost:3100/colorlab/portrait</loc></url>
  <url><loc>http://localhost:3100/vi/colorlab/portrait</loc></url>
  <url><loc>http://localhost:3100/recipe/b</loc></url>
  <url><loc>http://localhost:3100/vi/recipe/b</loc></url>
  <url><loc>http://localhost:3100/recipe/a</loc></url>
  <url><loc>http://localhost:3100/vi/recipe/a</loc></url>
  <url><loc>http://localhost:3100/blog/setup</loc></url>
  <url><loc>http://localhost:3100/vi/blog/setup</loc></url>
  <url><loc>http://localhost:3100/vi/blog/x</loc></url>
  <url><loc>http://localhost:3100/learn/glossary</loc></url>
  <url><loc>http://localhost:3100/vi/learn/glossary</loc></url>
</urlset>`;

const fake = (xml: string, status = 200) =>
  ({
    request: { get: async () => ({ ok: () => status >= 200 && status < 300, status: () => status, text: async () => xml }) },
  }) as unknown as Page;
const page = fake(XML);

/** `resolve` from a fresh copy of setup.ts, whose sitemap cache is empty. */
async function freshResolve() {
  vi.resetModules();
  return (await import('../e2e/setup')).resolve;
}

describe('resolve()', () => {
  it('resolves a recipe id from its bare sitemap entry', async () => {
    expect(await resolve(page, '/recipe/:recipe')).toBe('/recipe/a');
  });

  it('picks the smallest path under the prefix, not the first one listed', async () => {
    expect(await resolve(page, '/recipe/:recipe')).toBe('/recipe/a');
    expect(await resolve(page, '/recipe/:recipe')).not.toBe('/recipe/b');
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

  it('returns null for a knowledge page when none is published', async () => {
    expect(await resolve(page, '/learn/:knowledge')).toBeNull();
    expect(await resolve(page, '/vi/learn/:knowledge')).toBeNull();
  });

  /* Any other template with no instance is a broken sitemap or seed: a null
     there skipped the route and every walk passed without it. */
  it('throws when a camera has no instance in the sitemap', async () => {
    await expect(resolve(page, '/cameras/:camera')).rejects.toThrow('no instance of /cameras/:camera in the sitemap');
  });

  /* The catalogue (`/colorlab`, no trailing slash) is not a situation, and
     the smallest situation wins whichever order the sitemap lists them in. */
  it('resolves a situation off its bare sitemap entry, never the catalogue itself', async () => {
    expect(await resolve(page, '/colorlab/:situation')).toBe('/colorlab/portrait');
    expect(await resolve(page, '/vi/colorlab/:situation')).toBe('/vi/colorlab/portrait');
  });

  it('leaves a path with no placeholder unchanged', async () => {
    expect(await resolve(page, '/blog/setup')).toBe('/blog/setup');
  });
});

describe('sitemap()', () => {
  it('throws when the sitemap does not answer OK', async () => {
    const resolveFresh = await freshResolve();
    await expect(resolveFresh(fake('not found', 404), '/recipe/:recipe')).rejects.toThrow('/sitemap.xml answered 404');
  });

  it('throws when the sitemap lists no <loc>', async () => {
    const resolveFresh = await freshResolve();
    await expect(resolveFresh(fake('<urlset></urlset>'), '/recipe/:recipe')).rejects.toThrow('/sitemap.xml lists no <loc>');
  });
});

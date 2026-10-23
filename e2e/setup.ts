/**
 * What this project fills in for design-kit's gates (layout, wcag, targets,
 * perf, first-screen, visual). The specs import only from here.
 *
 * One role. Readers sign in with Google and administrators type their own
 * credentials plus a code from their authenticator on the control project, so
 * nothing can be signed in from a seed; the gates walk the public site in
 * both locales and the admin's signed-out screens (the gate itself).
 */
import type { Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export type Role = 'visitor';

/**
 * Every template once, in English (bare path) and Vietnamese (`/vi`). A
 * `:name` segment is resolved from the sitemap by `resolve()`; a template
 * with no instance (offline, no knowledge page is published) is skipped and
 * said so. `/admin` and the edit route show the gate to a signed-out visitor.
 */
const TEMPLATES = [
  '/', '/colorlab', '/colorlab?format=pp', '/recipe/:recipe',
  '/cameras', '/cameras/:camera', '/cameras/compare', '/audio', '/audio/:audio',
  '/blog', '/blog/:article', '/blog/setup', '/blog/:article/edit',
  '/learn', '/learn/glossary', '/learn/:knowledge',
  '/search?q=sony', '/admin',
];
export const ROUTES: Record<Role, string[]> = {
  visitor: TEMPLATES.flatMap((t) => (t.startsWith('/admin') ? [t] : [t, `/vi${t === '/' ? '' : t}`])),
};

/** The list and the detail page for the first-screen budget; the screens the visual check shoots. */
export const SCREENS = {
  list: '/colorlab',
  detail: '/recipe/:recipe',
  visual: ['/', '/colorlab', '/recipe/:recipe', '/cameras', '/cameras/:camera', '/blog', '/blog/:article', '/learn', '/vi/colorlab'],
};

/** Containers DESIGN.md §Scrollbars lets scroll sideways. Nothing else may. */
export const EXEMPT_SCROLL = '.scroll-silent, .filter-scroll, .scroll-area, .scroll-table';

/**
 * The sitemap prefix to search and strip for each placeholder. Recipes,
 * cameras and audio are listed bilingually (a bare-path and a `/vi/` entry
 * per instance), so the bare prefix finds one. An article or knowledge page
 * is authored Vietnamese-bodied on both locales (ADR 0004) and indexed ONLY
 * at its Vietnamese canonical URL — the English route renders the same
 * article under English chrome, not a translation of it — so those two
 * search the `/vi/...` prefix even though the id they find is spliced back
 * into whichever prefix the calling template already carries.
 */
const PREFIX: Record<string, string> = {
  ':recipe': '/recipe/', ':camera': '/cameras/', ':audio': '/audio/', ':article': '/vi/blog/', ':knowledge': '/vi/learn/',
};
let locs: string[] | null = null;
async function sitemap(page: Page): Promise<string[]> {
  if (locs) return locs;
  const xml = await (await page.request.get('/sitemap.xml')).text();
  locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
  return locs;
}

/**
 * `/recipe/:recipe` → `/recipe/<first slug in the sitemap>`; null when the
 * sitemap has no page under that prefix (the caller skips and logs). Static
 * siblings (`/blog/setup`, `/learn/glossary`, and their `/vi/` counterparts,
 * both bilingual) are not instances. `/blog/:article` and `/vi/blog/:article`
 * (plus the edit route) resolve from the same `/vi/blog/<id>` sitemap entry —
 * only the id moves, so the English template keeps the English prefix.
 */
export async function resolve(page: Page, path: string): Promise<string | null> {
  const key = Object.keys(PREFIX).find((k) => path.includes(k));
  if (!key) return path;
  const prefix = PREFIX[key];
  const skip = new Set(['/blog/setup', '/vi/blog/setup', '/blog/admin', '/vi/blog/admin', '/learn/glossary', '/vi/learn/glossary']);
  const hit = (await sitemap(page)).find((p) => p.startsWith(prefix) && !skip.has(p));
  if (!hit) return null;
  return path.replace(key, hit.slice(prefix.length));
}

/** The page has settled: the network is quiet and the fonts are in. */
export async function ready(page: Page) {
  await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});
  await page.evaluate(() => document.fonts.ready).catch(() => {});
}

/**
 * Faults a walk should fail on even when the page looks fine: an uncaught
 * error, a console error, a server answer of 500 or more. Call before the
 * first `goto`; the returned function lists what was seen so far.
 */
export function watch(page: Page): () => string[] {
  const seen: string[] = [];
  page.on('pageerror', (e) => seen.push(`pageerror: ${e.message.slice(0, 160)}`));
  page.on('console', (m) => {
    if (m.type() === 'error') seen.push(`console: ${m.text().slice(0, 160)}`);
  });
  page.on('response', (r) => {
    if (r.status() >= 500) seen.push(`${r.status()} ${new URL(r.url()).pathname}`);
  });
  return () => seen.splice(0);
}

/**
 * The catalogue's photographs live on three hosts outside this repo. The
 * runner's network must not decide a layout shift or an LCP, so every request
 * to them answers with one local picture.
 */
const PHOTO = readFileSync(join(import.meta.dirname, 'fixtures', 'photo.webp'));
export async function routeAssetHosts(page: Page) {
  await page.route(/https:\/\/(static\.bhphoto\.com|sony\.scene7\.com|www\.sony\.com\.vn)\//, (route) =>
    route.fulfill({ status: 200, contentType: 'image/webp', body: PHOTO }),
  );
}

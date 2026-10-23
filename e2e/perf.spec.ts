import { expect, test, type Browser, type Page } from '@playwright/test';
import { gzipSync } from 'node:zlib';
import { resolve, routeAssetHosts } from './setup.ts';

/*
 * Performance budgets on a phone with a slow CPU (4×) and 4G (9 Mbps,
 * 150 ms): CLS at most 0.05 while a screen loads; LCP at most 2.5 s; and the
 * JS a screen boots with (the chunks its HTML names, gzipped) at most its
 * budget. The catalogue's photographs come from a local fixture
 * (`routeAssetHosts`), so the runner's network decides nothing.
 *
 * Budgets only go down: when a change makes a screen lighter, lower its
 * number in the same PR. Measured 2026-10-23 on the seed build (the table the
 * run prints); src/app/ci.test.ts refuses the "measure me" placeholder.
 */

const CLS_MAX = 0.05;
const LCP_MAX = 2500;
/**
 * [path, KB of gzipped boot JS], measured 2026-10-23 on the seed build and
 * rounded up. Re-measured 2026-10-24 after the seed build stopped inheriting
 * a live build's data cache and `resolve()` began picking the smallest path:
 * `/recipe/alpine-cool` 189 KB and `/cameras/sony-dsc-rx100m7-e32` 177 KB,
 * the same numbers, so every budget stands.
 */
const SCREENS: [string, number][] = [
  ['/', 174], ['/colorlab', 184], ['/recipe/:recipe', 190], ['/cameras', 250], ['/cameras/:camera', 177],
  ['/audio', 250], ['/blog', 247], ['/blog/:article', 180], ['/learn', 247], ['/vi/colorlab', 184],
];

async function phone(browser: Browser) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await routeAssetHosts(page);
  // Once per page: a second registration would run two observers into one `__v` and double CLS.
  await page.addInitScript(() => {
    const w = window as unknown as { __v: Vitals };
    w.__v = { cls: 0, what: [], lcp: 0 };
    new PerformanceObserver((l) => {
      for (const e of l.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean; sources?: { node: Node | null }[] })[]) {
        if (e.hadRecentInput) continue;
        w.__v.cls += e.value;
        for (const s of e.sources ?? []) {
          const n = s.node as Element | null;
          if (n?.tagName) w.__v.what.push(`${n.tagName.toLowerCase()}.${String(n.className).split(/\s+/).slice(0, 3).join('.')} (${e.value.toFixed(3)})`);
        }
      }
    }).observe({ type: 'layout-shift', buffered: true });
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) w.__v.lcp = e.startTime;
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  });
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (9 * 1024 * 1024) / 8, uploadThroughput: (1.5 * 1024 * 1024) / 8 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  return { ctx, page };
}

type Vitals = { cls: number; what: string[]; lcp: number };

/** CLS with the elements that moved, and the LCP time, for one load (observers from `phone()`). */
async function load(page: Page, path: string): Promise<Vitals> {
  await page.goto(path, { waitUntil: 'load' });
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(1500);
  return page.evaluate(() => (window as unknown as { __v: Vitals }).__v);
}

/** KB of gzipped JS named by the screen's HTML (scripts for old browsers left out). */
async function bootJs(page: Page, path: string) {
  const res = await page.request.get(path);
  if (!res.ok()) throw new Error(`${path}: HTML answered ${res.status()}`);
  const html = await res.text();
  const srcs = [...html.matchAll(/<script\b([^>]*)>/g)]
    .filter((m) => !/\bnomodule\b/i.test(m[1]))
    .map((m) => /\bsrc="([^"]+\.js[^"]*)"/.exec(m[1])?.[1])
    .filter((s): s is string => !!s);
  let bytes = 0;
  for (const src of new Set(srcs)) {
    const js = await page.request.get(src);
    // A 404 page gzipped as JS would pass for a chunk.
    if (!js.ok()) throw new Error(`${path}: ${src} answered ${js.status()}`);
    bytes += gzipSync(await js.body()).length;
  }
  return Math.round(bytes / 1024);
}

test('every screen loads without jumping, paints in time and boots within its JS budget', async ({ browser }) => {
  test.setTimeout(900_000);
  const over: string[] = [];
  const table: string[] = [];
  for (const [template, budget] of SCREENS) {
    let { ctx, page } = await phone(browser);
    const path = await resolve(page, template);
    if (!path) { console.log(`skip ${template}: no instance in the sitemap`); await ctx.close(); continue; }
    let v = await load(page, path);
    // LCP on a throttled runner is noisy: one retry before it counts, cold, in a fresh context.
    if (v.lcp > LCP_MAX) {
      await ctx.close();
      ({ ctx, page } = await phone(browser));
      v = await load(page, path);
    }
    const js = await bootJs(page, path);
    table.push(`${path}: CLS ${v.cls.toFixed(3)}, LCP ${Math.round(v.lcp)} ms, JS ${js} KB / ${budget}`);
    if (v.cls > CLS_MAX) over.push(`${path}: CLS ${v.cls.toFixed(3)} > ${CLS_MAX} — ${[...new Set(v.what)].slice(0, 4).join(', ')}`);
    if (v.lcp > LCP_MAX) over.push(`${path}: LCP ${Math.round(v.lcp)} ms > ${LCP_MAX}`);
    if (js > budget) over.push(`${path}: ${js} KB of JS > its budget of ${budget} KB`);
    await ctx.close();
  }
  console.log(table.join('\n'));
  expect(over, over.join('\n')).toEqual([]);
});

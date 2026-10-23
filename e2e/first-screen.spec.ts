import { expect, test, type Page } from '@playwright/test';
import { SCREENS, ready, resolve, routeAssetHosts } from './setup.ts';

/*
 * The newcomer's first screen (design-kit's "tinh gọn" gate): on a phone,
 * signed out, how much the browse page and a recipe page ask before anyone
 * scrolls. The counts include the site's frame. They only go down: measured
 * once (the test prints the names), written into BUDGET, lowered when a change
 * removes something. Design-kit's targets: a list ≤ 12, a detail ≤ 7 plus the
 * frame.
 *
 * A recipe page is a reading layout of `<details>` parameter rows (AGENTS.md
 * Rule 4), each with a `<summary>`. Those are the content, not the frame, so
 * they are counted apart and reported as their own number.
 */

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

/** Controls in sight before any scroll, and the parameter rows among them, with names. */
async function inSight(page: Page) {
  return page.evaluate(() => {
    const seen = (el: Element) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return r.width > 1 && r.height > 1 && r.top < innerHeight && r.bottom > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && !el.closest('[aria-hidden="true"]');
    };
    const all = [...document.querySelectorAll('a[href],button,[role=button],input,select,summary')].filter(seen);
    const rows = all.filter((el) => el.matches('details.param-row > summary'));
    const controls = all.filter((el) => !rows.includes(el));
    const name = (el: Element) => (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 30);
    return { controls: controls.length, rows: rows.length, names: controls.map(name) };
  });
}

/** Measured 2026-10-23 on the seed build: the counts the run printed. */
const BUDGET = { list: 24, detail: 28, detailRows: 0 };

test('the first screens ask little: the list and a recipe page stay within their budgets', async ({ page }) => {
  await routeAssetHosts(page);
  await page.goto(SCREENS.list);
  await ready(page);
  const list = await inSight(page);
  console.log(`list ${list.controls}: ${list.names.join(' | ')}`);
  expect(list.controls, list.names.join(' | ')).toBeLessThanOrEqual(BUDGET.list);

  const detail = await resolve(page, SCREENS.detail);
  if (!detail) throw new Error('no recipe in the sitemap');
  await page.goto(detail);
  await ready(page);
  const d = await inSight(page);
  console.log(`detail ${d.controls} controls + ${d.rows} parameter rows: ${d.names.join(' | ')}`);
  expect(d.controls, d.names.join(' | ')).toBeLessThanOrEqual(BUDGET.detail);
  expect(d.rows).toBeLessThanOrEqual(BUDGET.detailRows);
  const screens = await page.evaluate(() => document.documentElement.scrollHeight / innerHeight);
  console.log(`detail height: ${screens.toFixed(1)} screens`);
  // Measured 2026-10-23 (7.08 screens); AGENTS.md calls this a reading layout, so the cap is the measurement, only down.
  expect(screens).toBeLessThanOrEqual(7.1);
});

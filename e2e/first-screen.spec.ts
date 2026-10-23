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
 * they are counted apart, logged, and held to no ceiling: a phone layout that
 * brings the settings up the page is the point, not a regression.
 *
 * "In sight" means on the screen: an element's box is clipped by the viewport
 * and by every scrolling or clipping ancestor, so a chip scrolled off the side
 * of a `.filter-scroll` rail does not count.
 */

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

/** Controls in sight before any scroll, and the parameter rows among them, with names. */
async function inSight(page: Page) {
  return page.evaluate(() => {
    const seen = (el: Element) => {
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none' || el.closest('[aria-hidden="true"]')) return false;
      const r = el.getBoundingClientRect();
      let [left, top, right, bottom] = [Math.max(r.left, 0), Math.max(r.top, 0), Math.min(r.right, innerWidth), Math.min(r.bottom, innerHeight)];
      for (let a = el.parentElement; a && a !== document.documentElement; a = a.parentElement) {
        const s = getComputedStyle(a);
        if (s.overflowX === 'visible' && s.overflowY === 'visible') continue;
        const c = a.getBoundingClientRect();
        [left, top, right, bottom] = [Math.max(left, c.left), Math.max(top, c.top), Math.min(right, c.right), Math.min(bottom, c.bottom)];
      }
      return right - left > 1 && bottom - top > 1;
    };
    const all = [...document.querySelectorAll('a[href],button,[role=button],input,select,summary')].filter(seen);
    const rows = all.filter((el) => el.matches('details.param-row > summary'));
    const controls = all.filter((el) => !rows.includes(el));
    const name = (el: Element) => (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 30);
    return { controls: controls.length, rows: rows.length, names: controls.map(name) };
  });
}

/**
 * Measured 2026-10-23 on the seed build, counting only what is on screen: the
 * counts the run printed. `detail` re-measured 2026-10-24 after fixing the
 * measurement, not raised: the instance is now the smallest recipe slug
 * (`alpine-cool`, nine tags in sight) rather than whichever came first, so
 * the number is that page's (14), where `mojave-sun` had printed 13.
 */
const BUDGET = { list: 6, detail: 14 };

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
  const screens = await page.evaluate(() => document.documentElement.scrollHeight / innerHeight);
  console.log(`detail height: ${screens.toFixed(1)} screens`);
  // Measured 2026-10-23 (7.08 screens, mojave-sun); re-measured 2026-10-24 on alpine-cool, which printed 6.3 —
  // toFixed(1) hides up to 0.05, so the cap is the next tenth. AGENTS.md calls this a reading layout, so the cap
  // is the measurement, only down.
  expect(screens).toBeLessThanOrEqual(6.4);
});

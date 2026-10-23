import { expect, test, type Page } from '@playwright/test';
import { report } from './budgets.ts';
import { EXEMPT_SCROLL, ROUTES, ready, resolve, routeAssetHosts } from './setup.ts';

/*
 * Every screen fits the device and nothing scrolls sideways (design-kit's
 * rule, DESIGN.md §Scrollbars): on a phone (390), a tablet (768) and a desktop
 * (1440), no page is wider than the window and no box inside it scrolls
 * sideways — except the four containers the design system names
 * (`EXEMPT_SCROLL`). Each test walks its routes and lists every offender, so
 * one run shows them all; a route may carry a recorded count in
 * e2e/budgets.json, which only goes down. Keyed `<path> · <width>` like axe:
 * a debt measured on a phone must not license the same count on a desktop.
 */

/** What overflows on this page: the page itself, and any box that scrolls sideways. */
async function overflow(page: Page, EXEMPT_SCROLL: string): Promise<string[]> {
  return page.evaluate((EXEMPT_SCROLL) => {
    const W = window.innerWidth;
    const out: string[] = [];
    const doc = document.documentElement;
    if (doc.scrollWidth > W + 1) {
      let worst: { w: number; d: string } | null = null;
      for (const el of Array.from(document.body.querySelectorAll<HTMLElement>('*'))) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.right <= W + 1) continue;
        let clipped = false;
        for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
          if (getComputedStyle(p).overflowX !== 'visible') { clipped = true; break; }
        }
        if (clipped) continue;
        if (!worst || r.right > worst.w) worst = { w: Math.round(r.right), d: el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className ? '.' + el.className.split(' ').slice(0, 3).join('.') : '') };
      }
      out.push(`page ${doc.scrollWidth}px > ${W}px` + (worst ? ` (${worst.d} reaches ${worst.w}px)` : ''));
    }
    for (const el of Array.from(document.body.querySelectorAll<HTMLElement>('*'))) {
      const s = getComputedStyle(el);
      if (!(s.overflowX === 'auto' || s.overflowX === 'scroll')) continue;
      if (el.scrollWidth <= el.clientWidth + 1) continue;
      if (el.tagName === 'TEXTAREA' || el.tagName === 'PRE' || el.closest('dialog:not([open])')) continue;
      // The design system's own sideways containers (DESIGN.md §Scrollbars).
      if (el.closest(EXEMPT_SCROLL)) continue;
      const label = el.getAttribute('aria-label') || el.getAttribute('role') || '';
      out.push(`scrolls sideways: ${el.tagName.toLowerCase()}.${String(el.className).split(' ').slice(0, 3).join('.')}${label ? ` [${label}]` : ''} ${el.scrollWidth}px in ${el.clientWidth}px`);
    }
    return out;
  }, EXEMPT_SCROLL);
}

for (const [role, routes] of Object.entries(ROUTES) as [keyof typeof ROUTES, string[]][]) {
  for (const size of [{ name: 'phone', width: 390, height: 844 }, { name: 'tablet', width: 768, height: 1024 }, { name: 'desktop', width: 1440, height: 900 }]) {
    test(`${role} · ${size.name}: no screen scrolls sideways`, async ({ page }) => {
      test.setTimeout(300_000);
      await page.setViewportSize({ width: size.width, height: size.height });
      await routeAssetHosts(page);
      const over: string[] = [];
      for (const route of routes) {
        const path = await resolve(page, route);
        if (!path) { console.log(`skip ${route}: no instance in the sitemap`); continue; }
        await page.goto(path);
        await ready(page);
        const found = await overflow(page, EXEMPT_SCROLL);
        if (!report('layout', `${path} · ${size.name}`, found)) over.push(`${path}: ${found.length} over budget — ${found.join('; ')}`);
      }
      expect(over, over.join('\n')).toEqual([]);
    });
  }
}

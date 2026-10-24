import { expect, test } from '@playwright/test';
import { budgetFor, report } from './budgets.ts';
import { small } from './checks.ts';
import { ROUTES, ready, resolve, routeAssetHosts } from './setup.ts';

/*
 * Touch targets on a phone (design-kit's "Mobile" gate): on every screen
 * (setup.ts ROUTES), at 390px with a touch screen, everything one taps is at
 * least 44 × 44px, counting the hit area a target draws around itself
 * (`::before` / `::after` with a negative inset). Exempt, as WCAG 2.5.5 has
 * it: a link inside a sentence; a link with an equivalent of 44px or more to
 * the same address (a card's title beside its picture); a control the browser
 * draws whose label is the target (a checkbox in its label). A route may carry
 * a recorded count in e2e/budgets.json, matched exactly and lowered when a
 * fix lands.
 */

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

for (const [role, routes] of Object.entries(ROUTES) as [keyof typeof ROUTES, string[]][]) {
  test(`${role}: every target on a phone is at least 44px`, async ({ page }) => {
    test.setTimeout(600_000);
    await routeAssetHosts(page);
    const over: string[] = [];
    for (const route of routes) {
      const path = await resolve(page, route);
      if (!path) { console.log(`skip ${route}: no knowledge page is published`); continue; }
      await page.goto(path);
      await ready(page);
      const found = await small(page, path);
      if (!report('targets', path, found)) over.push(`${path}: ${found.length}, recorded ${budgetFor('targets', path)}`);
    }
    expect(over, over.join('\n')).toEqual([]);
  });
}

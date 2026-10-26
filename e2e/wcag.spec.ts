import { expect, test } from '@playwright/test';
import { budgetFor, report } from './budgets.ts';
import { axe } from './checks.ts';
import { ROUTES, ready, resolve, routeAssetHosts, visit, watch } from './setup.ts';

/*
 * Accessibility, by axe-core, on every screen at a phone and a desktop width:
 * exactly the route's recorded count of serious or critical WCAG 2.1 A/AA
 * violations at that width (e2e/budgets.json, keyed `<path> · <width>`, zero
 * when absent, only ever lowered). One line per violating node, so fixing one
 * of four low-contrast labels lowers the count. The same walk fails
 * on an uncaught error, a console error or a 5xx — a page that renders and
 * logs an error is not a page that works (FeestFinder's axe walk caught a
 * crash this way).
 */

for (const [role, routes] of Object.entries(ROUTES) as [keyof typeof ROUTES, string[]][]) {
  for (const size of [{ name: 'phone', width: 390, height: 844 }, { name: 'desktop', width: 1440, height: 900 }]) {
    test(`${role} · ${size.name}: no serious or critical accessibility violation, no error`, async ({ page }) => {
      test.setTimeout(600_000);
      await page.setViewportSize({ width: size.width, height: size.height });
      await routeAssetHosts(page);
      const faults = watch(page);
      const over: string[] = [];
      for (const route of routes) {
        const path = await resolve(page, route);
        if (!path) { console.log(`skip ${route}: no knowledge page is published`); continue; }
        await visit(page, path);
        await ready(page);
        const found = await axe(page);
        if (!report('axe', `${path} · ${size.name}`, found)) over.push(`${path}: ${found.length}, recorded ${budgetFor('axe', `${path} · ${size.name}`)}`);
        const seen = faults();
        if (seen.length) over.push(`${path}: ${seen.join('; ')}`);
      }
      expect(over, over.join('\n')).toEqual([]);
    });
  }
}

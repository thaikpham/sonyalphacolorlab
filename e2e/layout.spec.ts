import { expect, test } from '@playwright/test';
import { budgetFor, report } from './budgets.ts';
import { overflow } from './checks.ts';
import { EXEMPT_SCROLL, ROUTES, ready, resolve, routeAssetHosts, visit } from './setup.ts';

/*
 * Every screen fits the device and nothing scrolls sideways (design-kit's
 * rule, DESIGN.md §Scrollbars): on a phone (390), a tablet (768) and a desktop
 * (1440), no page is wider than the window and no box inside it scrolls
 * sideways — except the four containers the design system names
 * (`EXEMPT_SCROLL`). Each test walks its routes and lists every offender, so
 * one run shows them all; a route may carry a recorded count in
 * e2e/budgets.json, matched exactly and lowered when a fix lands. Keyed
 * `<path> · <width>` like axe: a debt measured on a phone must not license
 * the same count on a desktop.
 */

for (const [role, routes] of Object.entries(ROUTES) as [keyof typeof ROUTES, string[]][]) {
  for (const size of [{ name: 'phone', width: 390, height: 844 }, { name: 'tablet', width: 768, height: 1024 }, { name: 'desktop', width: 1440, height: 900 }]) {
    test(`${role} · ${size.name}: no screen scrolls sideways`, async ({ page }) => {
      test.setTimeout(300_000);
      await page.setViewportSize({ width: size.width, height: size.height });
      await routeAssetHosts(page);
      const over: string[] = [];
      for (const route of routes) {
        const path = await resolve(page, route);
        if (!path) { console.log(`skip ${route}: no knowledge page is published`); continue; }
        await visit(page, path);
        await ready(page);
        const found = await overflow(page, EXEMPT_SCROLL);
        if (!report('layout', `${path} · ${size.name}`, found)) over.push(`${path}: ${found.length}, recorded ${budgetFor('layout', `${path} · ${size.name}`)} — ${found.join('; ')}`);
      }
      expect(over, over.join('\n')).toEqual([]);
    });
  }
}

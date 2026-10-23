import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { report } from './budgets.ts';
import { ROUTES, ready, resolve, watch } from './setup.ts';

/*
 * Accessibility, by axe-core, on every screen at a phone and a desktop width:
 * no serious or critical violation of WCAG 2.1 A/AA beyond the route's
 * recorded count (e2e/budgets.json, which only goes down). The same walk fails
 * on an uncaught error, a console error or a 5xx — a page that renders and
 * logs an error is not a page that works (FeestFinder's axe walk caught a
 * crash this way).
 */

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

for (const [role, routes] of Object.entries(ROUTES) as [keyof typeof ROUTES, string[]][]) {
  for (const size of [{ name: 'phone', width: 390, height: 844 }, { name: 'desktop', width: 1440, height: 900 }]) {
    test(`${role} · ${size.name}: no serious or critical accessibility violation, no error`, async ({ page }) => {
      test.setTimeout(600_000);
      await page.setViewportSize({ width: size.width, height: size.height });
      const faults = watch(page);
      const over: string[] = [];
      for (const route of routes) {
        const path = await resolve(page, route);
        if (!path) { console.log(`skip ${route}: no instance in the sitemap`); continue; }
        await page.goto(path);
        await ready(page);
        const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
        const found = violations
          .filter((v) => v.impact === 'serious' || v.impact === 'critical')
          .map((v) => `[${v.impact}] ${v.id} ×${v.nodes.length} — ${v.help} (${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')})`);
        if (!report('axe', path, found)) over.push(`${path}: ${found.length} over budget`);
        const seen = faults();
        if (seen.length) over.push(`${path}: ${seen.join('; ')}`);
      }
      expect(over, over.join('\n')).toEqual([]);
    });
  }
}

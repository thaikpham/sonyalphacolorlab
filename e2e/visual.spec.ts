import { expect, test } from '@playwright/test';
import { SCREENS, ready, resolve, routeAssetHosts, visit } from './setup.ts';

/*
 * The main screens as pictures, at a phone, a tablet and a desktop width, plus
 * two regions a 1 % full-page threshold would miss: the site header and the
 * recipe page's hero. Opt-in locally (fonts and decoding differ between
 * machines): `npm run test:visual`, `-- --update-snapshots` after an intended
 * change on a fresh build. CI does not use the local baselines: on every PR
 * that touches the front it shoots the base branch and the PR on the same
 * runner and compares (.github/workflows/visual.yml); the `visual-ok` label
 * accepts a difference, and a new push takes the label off again.
 */
test.skip(!process.env.CL_VISUAL, 'set CL_VISUAL=1 (npm run test:visual)');

const SIZES = [{ name: 'phone', width: 390, height: 844 }, { name: 'tablet', width: 768, height: 1024 }, { name: 'desktop', width: 1440, height: 900 }];
const name = (path: string, size: string) => `${path === '/' ? 'home' : path.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')}-${size}.png`;

for (const size of SIZES) {
  for (const template of SCREENS.visual) {
    test(`${template} · ${size.name}`, async ({ page }) => {
      test.setTimeout(90_000);
      await page.setViewportSize({ width: size.width, height: size.height });
      await routeAssetHosts(page);
      const path = await resolve(page, template);
      test.skip(!path, `no instance of ${template} in the sitemap`);
      await visit(page, path!);
      await ready(page);
      await expect(page).toHaveScreenshot(name(template, size.name), { fullPage: true, animations: 'disabled', caret: 'hide', maxDiffPixelRatio: 0.01 });
      // Regions where 1 % of a page is a whole changed element.
      if (template === '/recipe/:recipe') {
        await expect(page.locator('header').first()).toHaveScreenshot(`recipe-header-${size.name}.png`, { animations: 'disabled', maxDiffPixelRatio: 0.002 });
        // The hero is the block that holds the id and format chips, the h1,
        // the description and the tags (recipe/[slug]/page.tsx, "Recipe Header
        // & Description"): the h1's own wrapper, so a chip or a tag that moves
        // is caught along with the title.
        await expect(page.locator('main div:has(> h1)').first()).toHaveScreenshot(`recipe-hero-${size.name}.png`, { animations: 'disabled', maxDiffPixelRatio: 0.002 });
      }
    });
  }
}

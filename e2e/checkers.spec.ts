import { expect, test } from '@playwright/test';
import { axe, inSight, overflow, small } from './checks.ts';
import { EXEMPT_SCROLL } from './setup.ts';

/*
 * The guard on the guards, like floor.test.ts's "the scanner still works".
 * Every gate compares a count to e2e/budgets.json, and a checker that stops
 * seeing (a selector typo, a clip rule that swallows everything) would turn a
 * route green rather than red. Each checker gets a page built to break it, and
 * a twin that must not. Named to run first: Playwright takes the files of one
 * worker in name order, so a blind checker fails before the walks it feeds.
 * `setContent` needs no route of the app.
 */

test.use({ viewport: { width: 390, height: 844 } });

const HTML = (body: string) => `<!doctype html><html lang="en"><head><title>probe</title></head><body>${body}</body></html>`;

test('layout: a 600px box in a 390px window makes the page scroll sideways; a fitting one does not', async ({ page }) => {
  await page.setContent(HTML('<div style="width:600px;height:20px">wide</div>'));
  const wide = await overflow(page, EXEMPT_SCROLL);
  expect(wide.some((line) => line.startsWith('page ')), wide.join('\n')).toBe(true);

  await page.setContent(HTML('<div style="width:200px;height:20px">fits</div>'));
  expect(await overflow(page, EXEMPT_SCROLL)).toEqual([]);
});

test('targets: a 20×20 button is too small; a 48×48 one is not', async ({ page }) => {
  await page.setContent(HTML('<button style="width:20px;height:20px;padding:0">a</button>'));
  const tiny = await small(page, '/probe');
  expect(tiny, tiny.join('\n')).toHaveLength(1);
  expect(tiny[0]).toMatch(/\(20×20\)/);

  await page.setContent(HTML('<button style="width:48px;height:48px;padding:0">a</button>'));
  expect(await small(page, '/probe')).toEqual([]);
});

test('axe: an image without alt is flagged as image-alt; one with alt is not', async ({ page }) => {
  const PIXEL = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
  await page.setContent(HTML(`<main><img src="${PIXEL}" width="10" height="10"></main>`));
  const bare = await axe(page);
  expect(bare.some((line) => line.includes('] image-alt — ')), bare.join('\n')).toBe(true);

  await page.setContent(HTML(`<main><img src="${PIXEL}" width="10" height="10" alt="a dot"></main>`));
  expect((await axe(page)).filter((line) => line.includes('] image-alt — '))).toEqual([]);
});

test('first screen: a button in a closed panel off the screen is not in sight; one on it is', async ({ page }) => {
  await page.setContent(
    HTML(
      '<button style="width:48px;height:48px">here</button>' +
        '<div style="position:fixed;top:0;left:100vw;width:300px;height:100dvh"><button>away</button></div>',
    ),
  );
  const seen = await inSight(page);
  expect(seen.controls, seen.names.join(' | ')).toBe(1);
  expect(seen.names).toEqual(['here']);
});

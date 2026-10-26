# Browser gates and the PR checklist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every PR that touches the front is measured in a browser (layout, axe, 44px targets, CLS/JS/LCP budgets, first-screen counts, PR-vs-base screenshots), the rest of DESIGN.md's audit runs as a test, and the PR carries a design checklist — all budgets measured first, then only going down.

**Architecture:** design-kit's six Playwright specs are copied into `e2e/` and filled in through one `setup.ts` (visitor role only, routes resolved from `/sitemap.xml`, seed-mode production server on port 3100). The remaining DESIGN.md greps become six more rules in the existing `src/design/floor.ts` exact-baseline scanner. GitHub gets a parallel `screens` job, a PR-vs-base `Visual` workflow with a `visual-ok` label, and a parsed `## Thiết kế` checklist. Documents point at the tests instead of at greps.

**Tech Stack:** Next 16.3 (production build in seed mode), `@playwright/test` 1.64.1, `@axe-core/playwright` 4.14.0, Chromium, vitest 4 (node), GitHub Actions (Node 24), TypeScript run directly by Playwright.

Spec: `docs/superpowers/specs/2026-10-23-design-gates-design.md`.

## Global Constraints

- The web server under test is `npm run build && npx next start --port 3100` in **seed mode**: the six Supabase variables are blanked in the Playwright `webServer.env` (`NEXT_PUBLIC_AUTH_SUPABASE_URL`, `NEXT_PUBLIC_AUTH_SUPABASE_ANON_KEY`, `AUTH_SUPABASE_SECRET_KEY`, `NEXT_PUBLIC_CONTENT_SUPABASE_URL`, `CONTENT_SUPABASE_ANON_KEY`, `CONTENT_SUPABASE_SECRET_KEY`), because `.env.local` on the owner's machine holds live credentials and Next keeps a variable that is already in the environment, even empty, and `configurationMode()` treats empty as absent. Never run the gates against the live projects.
- `timezoneId: 'UTC'`, `workers: 1`, `fullyParallel: false`, `retries: process.env.CI ? 1 : 0`. No `WEB_SKIP_BUILD`-style reuse of a stale build for any decision.
- Budgets (JS per screen, first-screen counts, per-route target/axe counts) are **measured once with a permissive number, then written in with a dated comment, and only ever go down**. Never raise one.
- Exempt from the sideways-scroll rule: an element inside `.scroll-silent`, `.filter-scroll`, `.scroll-area` or `.scroll-table`. Nothing else.
- No new design token, no change to `CLAUDE.md` §Motion (D1); no per-line `tokens-ok`-style escape in the scanner — the only allowlists are the filenames DESIGN.md already names.
- Admin editors are not walked (D3): the production build has no signed-in admin. `/admin` and `/blog/:article/edit` are walked signed out (the gate screen).
- Every user-visible string the gates themselves add to the app (none expected) goes in `messages/*.json` in both locales. Workflow and template copy is Vietnamese for the owner, English in code comments.
- `npm test` must pass before each commit; run `npm run typecheck` and `npm run lint` (check `echo $?`, never pipe lint) before the last commit of a task. `e2e/**/*.spec.ts` is typechecked by `tsc --noEmit` (tsconfig includes `**/*.ts`) and linted by ESLint; vitest does not pick it up (`*.spec.ts`, not `*.test.ts`).
- Commit trailer: `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

## File structure

| File | Responsibility |
|---|---|
| `playwright.config.ts` (create) | testDir `e2e`, the production web server in seed mode, UTC, one worker, snapshot dir from `CL_SNAPSHOT_DIR` |
| `e2e/setup.ts` (create) | `ROUTES`, `SCREENS`, `resolve()` from the sitemap, `ready()`, `EXEMPT_SCROLL` selector, `watch()` |
| `e2e/budgets.json` (create) | Per-route counts for targets and axe that only go down, written by the first run |
| `e2e/fixtures/photo.webp` (create) | One small image served for the three product-photo hosts |
| `e2e/layout.spec.ts`, `wcag.spec.ts`, `targets.spec.ts`, `perf.spec.ts`, `first-screen.spec.ts`, `visual.spec.ts` (create) | The six gates |
| `src/app/globals.css` (modify) | `.scroll-table` under §Scrollbars |
| `src/components/camera-compare-view.tsx`, `src/components/camera-wiki-view.tsx` (modify) | The two tables use `.scroll-table` |
| `src/design/floor.ts`, `floor.test.ts`, `floor.baseline.json`, `scripts/design-baseline.ts` (modify) | Six new rules, probes, regenerated baseline, nine totals |
| `.github/workflows/ci.yml` (modify) | `screens` job; `verify` loses its duplicate build |
| `.github/workflows/visual.yml`, `.github/workflows/design-checklist.yml`, `.github/scripts/design-checklist.mjs`, `.github/pull_request_template.md` (create) | PR-vs-base pictures, the parsed checklist, the template |
| `scripts/design-checklist.test.ts`, `src/app/ci.test.ts` (create) | The gates' own tests |
| `docs/DESIGN_GOVERNANCE.md` (create); `DESIGN.md`, `docs/design-tooling.md`, `.claude/commands/design-sync.md`, `AGENTS.md`, `package.json`, `.gitignore` (modify) | Where the gates are explained and run from |

---

### Task 1: Playwright, the config, `setup.ts`, the fixture

**Files:**
- Modify: `package.json` (devDependencies, scripts), `.gitignore`
- Create: `playwright.config.ts`, `e2e/setup.ts`, `e2e/fixtures/photo.webp`
- Create: `src/app/ci.test.ts`

**Interfaces:**
- Produces, in `e2e/setup.ts`: `ROUTES: Record<Role, string[]>`, `SCREENS`, `resolve(page, path): Promise<string | null>` (null = no instance in the sitemap, skip with a log), `ready(page)`, `EXEMPT_SCROLL` (a CSS selector string), `watch(page): () => string[]`, `routeAssetHosts(page)` (fulfils the three photo hosts with the fixture).

- [ ] **Step 1: Write the failing test** — `src/app/ci.test.ts`:

```ts
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The browser gates' own wiring, pinned at the source. The gates run in CI
 * against a production build; a config that quietly reused a stale build, ran
 * in the machine's time zone or let specs share a browser in parallel would
 * pass and prove nothing (design-kit LEARNINGS.md §3 "Chưa tốt").
 */
const read = (p: string) => readFileSync(p, 'utf8');

describe('playwright.config.ts', () => {
  const src = read('playwright.config.ts');

  it('builds and starts a production server in seed mode, never a dev server', () => {
    expect(src).toMatch(/npm run build && npx next start --port 3100/);
    expect(src).not.toMatch(/next dev|WEB_SKIP_BUILD|reuseExistingServer: true/);
    for (const v of [
      'NEXT_PUBLIC_AUTH_SUPABASE_URL', 'NEXT_PUBLIC_AUTH_SUPABASE_ANON_KEY', 'AUTH_SUPABASE_SECRET_KEY',
      'NEXT_PUBLIC_CONTENT_SUPABASE_URL', 'CONTENT_SUPABASE_ANON_KEY', 'CONTENT_SUPABASE_SECRET_KEY',
    ]) expect(src, `${v} is not blanked for the server under test`).toMatch(new RegExp(`${v}: ''`));
  });

  it('pins the clock, one worker and no parallel files', () => {
    expect(src).toMatch(/timezoneId: 'UTC'/);
    expect(src).toMatch(/workers: 1/);
    expect(src).toMatch(/fullyParallel: false/);
  });

  it('lets the visual workflow place snapshots outside the tree', () => {
    expect(src).toMatch(/CL_SNAPSHOT_DIR/);
  });
});

describe('e2e/setup.ts', () => {
  const src = read('e2e/setup.ts');

  it('walks the visitor only: no seedable sign-in exists', () => {
    expect(src).toMatch(/export type Role = 'visitor'/);
    expect(src).not.toMatch(/password/i);
  });

  it('resolves detail ids from the sitemap instead of typing a slug', () => {
    expect(src).toMatch(/\/sitemap\.xml/);
    expect(src).not.toMatch(/mojave-sun|iso-auto-min-ss|sony-ilme-fx2b/);
  });

  it('exempts exactly the sanctioned scroll containers', () => {
    expect(src).toMatch(/EXEMPT_SCROLL = '\.scroll-silent, \.filter-scroll, \.scroll-area, \.scroll-table'/);
  });

  it('walks both locales', () => {
    expect(src).toMatch(/'\/vi\$\{|`\/vi\$\{/);
  });
});

describe('package.json', () => {
  const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string>; devDependencies: Record<string, string> };

  it('names the three gate commands', () => {
    expect(pkg.scripts['test:screens']).toBe('playwright test');
    expect(pkg.scripts['test:visual']).toBe('CL_VISUAL=1 playwright test e2e/visual.spec.ts');
    expect(pkg.scripts['verify:screens']).toBe('npm run verify && npm run test:screens');
  });

  it('has Playwright and axe', () => {
    expect(pkg.devDependencies['@playwright/test']).toBeDefined();
    expect(pkg.devDependencies['@axe-core/playwright']).toBeDefined();
  });
});

describe('the fixture', () => {
  it('exists and is small', () => {
    expect(existsSync('e2e/fixtures/photo.webp')).toBe(true);
    expect(readFileSync('e2e/fixtures/photo.webp').length).toBeLessThan(20_000);
  });
});
```

- [ ] **Step 2: Run it and see it fail** — `npx vitest run src/app/ci.test.ts` → FAIL (no config).

- [ ] **Step 3: Install** — `npm i -D @playwright/test@1.64.1 @axe-core/playwright@4.14.0` then `npx playwright install chromium` (on the owner's machine `--with-deps` may need sudo; without it Chromium still installs). Add to `package.json` scripts, after `"design:baseline"`:

```json
 "//test:screens": "The browser gates (e2e/): layout at 390/768/1440, axe, 44px targets, CLS/JS/LCP budgets, first-screen counts. Builds and starts a production server in seed mode on :3100 (playwright.config.ts). Ten minutes; CI runs it as its own job beside verify.",
 "test:screens": "playwright test",
 "test:visual": "CL_VISUAL=1 playwright test e2e/visual.spec.ts",
 "verify:screens": "npm run verify && npm run test:screens",
```

Append to `.gitignore`:

```
# Playwright: traces, reports and local visual baselines (per machine; CI
# compares a PR with its base instead — .github/workflows/visual.yml).
/test-results/
/playwright-report/
/e2e/**/*-snapshots/
```

- [ ] **Step 4: Create `playwright.config.ts`**

```ts
import { defineConfig, devices } from '@playwright/test';

/**
 * The browser gates (e2e/) against this app in production mode.
 *
 * Seed mode on purpose: the six Supabase variables are blanked for the server
 * under test, because a developer's `.env.local` holds the live projects and
 * Next keeps a variable that is already in the environment, even an empty
 * one — `configurationMode()` then reads "offline". The gates must never read
 * or write the live catalogue. On CI there is no `.env.local`; blanking is a
 * no-op there and a guard here.
 *
 * A fresh build every run. `next start` serves the manifests it booted with;
 * a server older than the build serves a ghost (AGENTS.md), and a cached build
 * carried another run's ids into FeestFinder's screens (design-kit LEARNINGS).
 */
const PORT = Number(process.env.SCREENS_PORT ?? 3100);
const WEB = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  ...(process.env.CL_SNAPSHOT_DIR ? { snapshotPathTemplate: `${process.env.CL_SNAPSHOT_DIR}/{arg}{ext}` } : {}),
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    // CI runs in UTC; a developer's machine does not. One clock for every run.
    timezoneId: 'UTC',
    baseURL: WEB,
    ...devices['Desktop Chrome'],
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `npm run build && npx next start --port ${PORT}`,
    url: `${WEB}/robots.txt`,
    timeout: 300_000,
    reuseExistingServer: false,
    env: {
      NEXT_PUBLIC_AUTH_SUPABASE_URL: '',
      NEXT_PUBLIC_AUTH_SUPABASE_ANON_KEY: '',
      AUTH_SUPABASE_SECRET_KEY: '',
      NEXT_PUBLIC_CONTENT_SUPABASE_URL: '',
      CONTENT_SUPABASE_ANON_KEY: '',
      CONTENT_SUPABASE_SECRET_KEY: '',
      NEXT_PUBLIC_SITE_URL: WEB,
      NEXT_TELEMETRY_DISABLED: '1',
    },
  },
});
```

- [ ] **Step 5: Create `e2e/setup.ts`**

```ts
/**
 * What this project fills in for design-kit's gates (layout, wcag, targets,
 * perf, first-screen, visual). The specs import only from here.
 *
 * One role. Readers sign in with Google and administrators type their own
 * credentials plus a code from their authenticator on the control project, so
 * nothing can be signed in from a seed; the gates walk the public site in
 * both locales and the admin's signed-out screens (the gate itself).
 */
import type { Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export type Role = 'visitor';

/**
 * Every template once, in English (bare path) and Vietnamese (`/vi`). A
 * `:name` segment is resolved from the sitemap by `resolve()`; a template
 * with no instance (offline, no knowledge page is published) is skipped and
 * said so. `/admin` and the edit route show the gate to a signed-out visitor.
 */
const TEMPLATES = [
  '/', '/colorlab', '/colorlab?format=pp', '/recipe/:recipe',
  '/cameras', '/cameras/:camera', '/cameras/compare', '/audio', '/audio/:audio',
  '/blog', '/blog/:article', '/blog/setup', '/blog/:article/edit',
  '/learn', '/learn/glossary', '/learn/:knowledge',
  '/search?q=sony', '/admin',
];
export const ROUTES: Record<Role, string[]> = {
  visitor: TEMPLATES.flatMap((t) => (t.startsWith('/admin') ? [t] : [t, `/vi${t === '/' ? '' : t}`])),
};

/** The list and the detail page for the first-screen budget; the screens the visual check shoots. */
export const SCREENS = {
  list: '/colorlab',
  detail: '/recipe/:recipe',
  visual: ['/', '/colorlab', '/recipe/:recipe', '/cameras', '/cameras/:camera', '/blog', '/blog/:article', '/learn', '/vi/colorlab'],
};

/** Containers DESIGN.md §Scrollbars lets scroll sideways. Nothing else may. */
export const EXEMPT_SCROLL = '.scroll-silent, .filter-scroll, .scroll-area, .scroll-table';

/** The first sitemap entry under each prefix, read once per run. */
const PREFIX: Record<string, string> = {
  ':recipe': '/recipe/', ':camera': '/cameras/', ':audio': '/audio/', ':article': '/blog/', ':knowledge': '/learn/',
};
let locs: string[] | null = null;
async function sitemap(page: Page): Promise<string[]> {
  if (locs) return locs;
  const xml = await (await page.request.get('/sitemap.xml')).text();
  locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
  return locs;
}

/**
 * `/recipe/:recipe` → `/recipe/<first slug in the sitemap>`; null when the
 * sitemap has no page under that prefix (the caller skips and logs). Static
 * siblings (`/blog/setup`, `/learn/glossary`) are not instances.
 */
export async function resolve(page: Page, path: string): Promise<string | null> {
  const key = Object.keys(PREFIX).find((k) => path.includes(k));
  if (!key) return path;
  const prefix = PREFIX[key];
  const skip = new Set(['/blog/setup', '/blog/admin', '/learn/glossary']);
  const hit = (await sitemap(page)).find((p) => p.startsWith(prefix) && !skip.has(p) && !p.startsWith('/vi/'));
  if (!hit) return null;
  return path.replace(key, hit.slice(prefix.length));
}

/** The page has settled: the network is quiet and the fonts are in. */
export async function ready(page: Page) {
  await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});
  await page.evaluate(() => document.fonts.ready).catch(() => {});
}

/**
 * Faults a walk should fail on even when the page looks fine: an uncaught
 * error, a console error, a server answer of 500 or more. Call before the
 * first `goto`; the returned function lists what was seen so far.
 */
export function watch(page: Page): () => string[] {
  const seen: string[] = [];
  page.on('pageerror', (e) => seen.push(`pageerror: ${e.message.slice(0, 160)}`));
  page.on('console', (m) => {
    if (m.type() === 'error') seen.push(`console: ${m.text().slice(0, 160)}`);
  });
  page.on('response', (r) => {
    if (r.status() >= 500) seen.push(`${r.status()} ${new URL(r.url()).pathname}`);
  });
  return () => seen.splice(0);
}

/**
 * The catalogue's photographs live on three hosts outside this repo. The
 * runner's network must not decide a layout shift or an LCP, so every request
 * to them answers with one local picture.
 */
const PHOTO = readFileSync(join(import.meta.dirname, 'fixtures', 'photo.webp'));
export async function routeAssetHosts(page: Page) {
  await page.route(/https:\/\/(static\.bhphoto\.com|sony\.scene7\.com|www\.sony\.com\.vn)\//, (route) =>
    route.fulfill({ status: 200, contentType: 'image/webp', body: PHOTO }),
  );
}
```

`import.meta.dirname` is Node 20.11+; the repo runs Node 24.

- [ ] **Step 6: Create the fixture** — a 320×200 neutral grey WebP, under 20 KB, made with sharp (already a dependency):

```bash
node -e "require('sharp')({create:{width:320,height:200,channels:3,background:{r:40,g:42,b:48}}}).webp({quality:60}).toFile('e2e/fixtures/photo.webp').then(()=>console.log('ok'))"
```

- [ ] **Step 7: Prove the config boots** — `npx playwright test --list` lists zero tests but parses the config without error; then run `npx vitest run src/app/ci.test.ts && npm run typecheck && npm run lint` → PASS, lint exit 0.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json .gitignore playwright.config.ts e2e/setup.ts e2e/fixtures/photo.webp src/app/ci.test.ts
git commit -m "Browser gates: Playwright, a seed-mode production server, and the routes to walk"
```

### Task 2: `.scroll-table`, and the layout gate

**Files:**
- Modify: `src/app/globals.css` (§Scrollbars), `DESIGN.md` (§Scrollbars), `src/components/camera-compare-view.tsx:441`, `src/components/camera-wiki-view.tsx:494`
- Create: `e2e/layout.spec.ts`
- Modify: `src/app/ci.test.ts`

**Interfaces:**
- Consumes: `ROUTES`, `resolve`, `ready`, `EXEMPT_SCROLL` from `e2e/setup.ts`.

- [ ] **Step 1: Write the failing test** — append to `src/app/ci.test.ts`:

```ts
describe('.scroll-table', () => {
  it('is the named exception for a table wider than its column, and the two tables use it', () => {
    expect(read('src/app/globals.css')).toMatch(/\.scroll-table \{\s*overflow-x: auto;\s*overscroll-behavior-x: contain;/);
    expect(read('DESIGN.md')).toMatch(/`\.scroll-table`/);
    for (const f of ['src/components/camera-compare-view.tsx', 'src/components/camera-wiki-view.tsx']) {
      const src = read(f);
      expect(src, f).toMatch(/className="scroll-table max-h-\[75dvh\]/);
      expect(src, f).not.toMatch(/overflow-x-auto overscroll-x-contain/);
    }
  });
});

describe('e2e/layout.spec.ts', () => {
  const src = read('e2e/layout.spec.ts');
  it('exempts only the sanctioned containers from the box rule, and nothing from the page rule', () => {
    expect(src).toMatch(/closest\(EXEMPT_SCROLL\)/);
    expect(src).toMatch(/doc\.scrollWidth > W \+ 1/);
  });
});
```

- [ ] **Step 2: Run it and see it fail** — `npx vitest run src/app/ci.test.ts` → FAIL.

- [ ] **Step 3: The class** — in `src/app/globals.css`, directly after the `.scroll-area` rule:

```css
/* A table wider than its column: it scrolls sideways and a sideways swipe
   stops at its edge instead of becoming browser back-navigation. Contains x
   only — `.scroll-area` would also contain y and stop the table handing the
   page scroll back at its last row (camera-compare-view.tsx explains the
   gesture latch). The layout gate (e2e/layout.spec.ts) lets exactly this,
   `.scroll-silent`, `.filter-scroll` and `.scroll-area` scroll sideways. */
.scroll-table {
  overflow-x: auto;
  overscroll-behavior-x: contain;
}
```

In `camera-compare-view.tsx:441` change `className="overflow-x-auto overscroll-x-contain max-h-[75dvh]"` to `className="scroll-table max-h-[75dvh]"`; in `camera-wiki-view.tsx:494` change `className="overflow-x-auto overscroll-x-contain max-h-[75dvh] 2xl:max-h-none"` to `className="scroll-table max-h-[75dvh] 2xl:max-h-none"`. Keep both comments; in the compare comment, after "Keep the containment on x only, …", add one sentence: "That is `.scroll-table`, the named exception the layout gate accepts."

In `DESIGN.md` §Scrollbars, after the `.scroll-area` bullet add:

```markdown
- `.scroll-table` for a table wider than its column (compare, wiki specs): x
  scroll with x containment only. These three classes and `.filter-scroll` are
  the only boxes the layout gate (`e2e/layout.spec.ts`) lets scroll sideways.
```

- [ ] **Step 4: Create `e2e/layout.spec.ts`** — design-kit's, with the skip:

```ts
import { expect, test, type Page } from '@playwright/test';
import { EXEMPT_SCROLL, ROUTES, ready, resolve } from './setup.ts';

/*
 * Every screen fits the device and nothing scrolls sideways (design-kit's
 * rule, DESIGN.md §Scrollbars): on a phone (390), a tablet (768) and a desktop
 * (1440), no page is wider than the window and no box inside it scrolls
 * sideways — except the four containers the design system names
 * (`EXEMPT_SCROLL`). Each test walks its routes and lists every offender, so
 * one run shows them all.
 */

/** What overflows on this page: the page itself, and any box that scrolls sideways. */
async function overflow(page: Page, exempt: string): Promise<string[]> {
  return page.evaluate((exempt) => {
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
      if (el.closest(exempt)) continue;
      const label = el.getAttribute('aria-label') || el.getAttribute('role') || '';
      out.push(`scrolls sideways: ${el.tagName.toLowerCase()}.${String(el.className).split(' ').slice(0, 3).join('.')}${label ? ` [${label}]` : ''} ${el.scrollWidth}px in ${el.clientWidth}px`);
    }
    return out;
  }, exempt);
}

for (const [role, routes] of Object.entries(ROUTES) as [keyof typeof ROUTES, string[]][]) {
  for (const size of [{ name: 'phone', width: 390, height: 844 }, { name: 'tablet', width: 768, height: 1024 }, { name: 'desktop', width: 1440, height: 900 }]) {
    test(`${role} · ${size.name}: no screen scrolls sideways`, async ({ page }) => {
      test.setTimeout(300_000);
      await page.setViewportSize({ width: size.width, height: size.height });
      const failures: string[] = [];
      for (const route of routes) {
        const path = await resolve(page, route);
        if (!path) { console.log(`skip ${route}: no instance in the sitemap`); continue; }
        await page.goto(path);
        await ready(page);
        for (const f of await overflow(page, EXEMPT_SCROLL)) failures.push(`${path}: ${f}`);
      }
      expect(failures, failures.join('\n')).toEqual([]);
    });
  }
}
```

- [ ] **Step 5: Run it** — `npx playwright test e2e/layout.spec.ts` (first run builds; ~5 min). Read every failure. Fix what is a defect this plan owns (a box that should carry `.scroll-silent` and does not; `.scroll-table` missing) in the same task; anything else that is a real layout defect in a page goes into the report as a finding for sub-project 5 **and** into `e2e/budgets.json` (Task 3's shape) under `layout` for that route, so the gate is green and the number can only go down. Expected: few or none — the site was already checked at 390 by hand.

- [ ] **Step 6: Run the gate's own tests** — `npx vitest run src/app/ci.test.ts src/design && npm run typecheck && npm run lint` → PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app/globals.css DESIGN.md src/components/camera-compare-view.tsx src/components/camera-wiki-view.tsx e2e/layout.spec.ts src/app/ci.test.ts
git commit -m "Layout gate: no screen scrolls sideways at 390/768/1440; .scroll-table names the two wide tables"
```

### Task 3: axe, 44px targets, and the per-route baseline

The kit asserts zero. ColorLab has never been measured, and FeestFinder's first targets run found 498. So each walked route carries a count in `e2e/budgets.json` that the first run writes and later runs may only lower — the same shape as `floor.baseline.json`.

**Files:**
- Create: `e2e/budgets.json`, `e2e/budgets.ts`, `e2e/wcag.spec.ts`, `e2e/targets.spec.ts`
- Modify: `src/app/ci.test.ts`

**Interfaces:**
- Produces, in `e2e/budgets.ts`: `budgetFor(kind: 'layout' | 'axe' | 'targets', path: string): number` (0 when the route has no entry) and `report(kind, path, found: string[])` which prints the list and returns `found.length <= budgetFor(kind, path)`; `e2e/budgets.json` is `{ "<kind>": { "<path>": <n> } }` with a `"//"` key holding the date and the rule.

- [ ] **Step 1: Write the failing test** — append to `src/app/ci.test.ts`:

```ts
describe('e2e/budgets.json', () => {
  const budgets = JSON.parse(read('e2e/budgets.json')) as Record<string, Record<string, number>>;
  it('carries only the three per-route kinds, every count a non-negative integer', () => {
    expect(Object.keys(budgets).filter((k) => k !== '//').sort()).toEqual(['axe', 'layout', 'targets']);
    for (const kind of ['axe', 'layout', 'targets']) {
      for (const [path, n] of Object.entries(budgets[kind] ?? {})) {
        expect(path.startsWith('/'), `${kind} ${path}`).toBe(true);
        expect(Number.isInteger(n) && n >= 0, `${kind} ${path} = ${n}`).toBe(true);
      }
    }
  });
});

describe('e2e/wcag.spec.ts and targets.spec.ts', () => {
  it('fail on faults a page can hide, and read their budgets from one file', () => {
    const wcag = read('e2e/wcag.spec.ts');
    expect(wcag).toMatch(/watch\(page\)/);
    expect(wcag).toMatch(/withTags\(TAGS\)/);
    expect(wcag).toMatch(/report\('axe'/);
    const targets = read('e2e/targets.spec.ts');
    expect(targets).toMatch(/const MIN = 44/);
    expect(targets).toMatch(/report\('targets'/);
  });
});
```

- [ ] **Step 2: Run it and see it fail** — `npx vitest run src/app/ci.test.ts` → FAIL.

- [ ] **Step 3: `e2e/budgets.ts` and the empty `budgets.json`**

```ts
/**
 * Per-route counts for the gates that found more than zero on the first run.
 * The same rule as src/design/floor.baseline.json: a number here is what was
 * measured, it may only go down, and a drop is committed in the same PR as
 * the fix. A route with no entry is held at zero.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export type Kind = 'layout' | 'axe' | 'targets';
const FILE = join(import.meta.dirname, 'budgets.json');
const budgets = JSON.parse(readFileSync(FILE, 'utf8')) as Record<string, Record<string, number>>;

export function budgetFor(kind: Kind, path: string): number {
  return budgets[kind]?.[path] ?? 0;
}

/** Prints what was found and whether the route is within its budget. */
export function report(kind: Kind, path: string, found: readonly string[]): boolean {
  const budget = budgetFor(kind, path);
  if (found.length) console.log(`${kind} ${path}: ${found.length}/${budget}\n  ${found.join('\n  ')}`);
  if (found.length < budget) console.log(`${kind} ${path}: ${found.length} < ${budget} — lower it in e2e/budgets.json`);
  return found.length <= budget;
}
```

`e2e/budgets.json`, to start:

```json
{
  "//": "Measured 2026-10-23 on the seed build; counts may only go down. A route with no entry is held at 0.",
  "layout": {},
  "axe": {},
  "targets": {}
}
```

Also change `e2e/layout.spec.ts` (Task 2) to use it: collect failures per path and push `${path}` to a `over` list when `!report('layout', path, found)`; assert `over` is empty.

- [ ] **Step 4: Create `e2e/wcag.spec.ts`** — design-kit's, with `watch` and the budget:

```ts
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
```

Chrome logs a console error for a 404 image or a blocked request; `watch` counts console errors, so if the first run reports only such noise on a route whose source is a third-party asset, narrow `watch` to `pageerror` + 5xx and say so in the report — do not silence it per route.

- [ ] **Step 5: Create `e2e/targets.spec.ts`** — design-kit's `small()` verbatim (the `drawn`, `size`, `biggest`, inline-link and label exemptions), with: `const MIN = 44;`, the class filter `c.startsWith('surface') || c.startsWith('btn-') || c.startsWith('chip') || c === 'label' || c === 'meta'` in place of `c.startsWith('kd-')`, and the walk:

```ts
for (const [role, routes] of Object.entries(ROUTES) as [keyof typeof ROUTES, string[]][]) {
  test(`${role}: every target on a phone is at least 44px`, async ({ page }) => {
    test.setTimeout(600_000);
    const over: string[] = [];
    for (const route of routes) {
      const path = await resolve(page, route);
      if (!path) { console.log(`skip ${route}: no instance in the sitemap`); continue; }
      await page.goto(path);
      await ready(page);
      const found = await small(page, path);
      if (!report('targets', path, found)) over.push(`${path}: ${found.length} over budget`);
    }
    expect(over, over.join('\n')).toEqual([]);
  });
}
```

with `test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });` as in the kit.

- [ ] **Step 6: Measure** — `npx playwright test e2e/wcag.spec.ts e2e/targets.spec.ts`. Read every line. Then, per route and kind:
  - a fault this plan owns (a `<main>` duplicated by a gate screen, a `<details>` in a `<dl>`, a 38px chip the design system already sizes at 44) → fix it in the same task;
  - everything else → its count into `budgets.json` under that kind and path, verbatim list in the task report, so sub-project 5 has the to-do.
  Re-run until green. Record the two printed tables in the report.

- [ ] **Step 7: Run the gate's own tests** — `npx vitest run src/app/ci.test.ts && npm run typecheck && npm run lint` → PASS.

- [ ] **Step 8: Commit**

```bash
git add e2e/budgets.json e2e/budgets.ts e2e/wcag.spec.ts e2e/targets.spec.ts e2e/layout.spec.ts src/app/ci.test.ts
git commit -m "Gates: axe serious/critical, 44px targets and a 5xx/error watch, with per-route counts that only go down"
```

### Task 4: CLS, boot JS, LCP, and the first screen

**Files:**
- Create: `e2e/perf.spec.ts`, `e2e/first-screen.spec.ts`
- Modify: `src/app/ci.test.ts`

**Interfaces:**
- Consumes: `SCREENS`, `resolve`, `ready`, `routeAssetHosts` from `e2e/setup.ts`.

- [ ] **Step 1: Write the failing test** — append to `src/app/ci.test.ts`:

```ts
describe('e2e/perf.spec.ts', () => {
  const src = read('e2e/perf.spec.ts');
  it('throttles like a phone, routes the photo hosts, and holds CLS, JS and LCP to budgets', () => {
    expect(src).toMatch(/setCPUThrottlingRate', \{ rate: 4 \}/);
    expect(src).toMatch(/routeAssetHosts\(page\)/);
    expect(src).toMatch(/const CLS_MAX = 0\.05/);
    expect(src).toMatch(/const LCP_MAX = 2500/);
    expect(src).toMatch(/largest-contentful-paint/);
  });
  it('has no placeholder budget left once measured', () => {
    /* 999 is the "measure me" value. The plan writes the measured numbers in
       the same task that adds the spec. */
    expect(src).not.toMatch(/, 999\]/);
  });
});

describe('e2e/first-screen.spec.ts', () => {
  const src = read('e2e/first-screen.spec.ts');
  it('counts the parameter rows apart from the controls, and has measured budgets', () => {
    expect(src).toMatch(/details\.param-row > summary/);
    expect(src).not.toMatch(/BUDGET = \{ list: 99, detail: 99/);
  });
});
```

- [ ] **Step 2: Run it and see it fail** — `npx vitest run src/app/ci.test.ts` → FAIL.

- [ ] **Step 3: Create `e2e/perf.spec.ts`** — design-kit's with LCP and the routed hosts:

```ts
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
 * run prints); 999 means "not measured yet" and src/app/ci.test.ts refuses it.
 */

const CLS_MAX = 0.05;
const LCP_MAX = 2500;
/** [path, KB of gzipped boot JS]. */
const SCREENS: [string, number][] = [
  ['/', 999], ['/colorlab', 999], ['/recipe/:recipe', 999], ['/cameras', 999], ['/cameras/:camera', 999],
  ['/audio', 999], ['/blog', 999], ['/blog/:article', 999], ['/learn', 999], ['/vi/colorlab', 999],
];

async function phone(browser: Browser) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await routeAssetHosts(page);
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (9 * 1024 * 1024) / 8, uploadThroughput: (1.5 * 1024 * 1024) / 8 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  return { ctx, page };
}

type Vitals = { cls: number; what: string[]; lcp: number };

/** CLS with the elements that moved, and the LCP time, for one load. */
async function load(page: Page, path: string): Promise<Vitals> {
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
  await page.goto(path, { waitUntil: 'load' });
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(1500);
  return page.evaluate(() => (window as unknown as { __v: Vitals }).__v);
}

/** KB of gzipped JS named by the screen's HTML (scripts for old browsers left out). */
async function bootJs(page: Page, path: string) {
  const html = await (await page.request.get(path)).text();
  const srcs = [...html.matchAll(/<script\b([^>]*)>/g)]
    .filter((m) => !/\bnomodule\b/i.test(m[1]))
    .map((m) => /\bsrc="([^"]+\.js[^"]*)"/.exec(m[1])?.[1])
    .filter((s): s is string => !!s);
  let bytes = 0;
  for (const src of new Set(srcs)) bytes += gzipSync(await (await page.request.get(src)).body()).length;
  return Math.round(bytes / 1024);
}

test('every screen loads without jumping, paints in time and boots within its JS budget', async ({ browser }) => {
  test.setTimeout(900_000);
  const over: string[] = [];
  const table: string[] = [];
  for (const [template, budget] of SCREENS) {
    const { ctx, page } = await phone(browser);
    const path = await resolve(page, template);
    if (!path) { console.log(`skip ${template}: no instance in the sitemap`); await ctx.close(); continue; }
    let v = await load(page, path);
    // LCP on a throttled runner is noisy: one retry before it counts.
    if (v.lcp > LCP_MAX) v = await load(page, path);
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
```

- [ ] **Step 4: Create `e2e/first-screen.spec.ts`**

```ts
import { expect, test, type Page } from '@playwright/test';
import { SCREENS, ready, resolve } from './setup.ts';

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

/** Measured 2026-10-23 on the seed build; 99 means "not measured yet". */
const BUDGET = { list: 99, detail: 99, detailRows: 99 };

test('the first screens ask little: the list and a recipe page stay within their budgets', async ({ page }) => {
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
});
```

Check the ParamRow selector before relying on it: `rg -n "param-row" src/components/settings-table.tsx`. If the class is named differently, use the real one in both the spec and the `ci.test.ts` assertion.

- [ ] **Step 5: Measure, then write the numbers** — `npx playwright test e2e/perf.spec.ts e2e/first-screen.spec.ts`. Copy the printed tables into the task report. Write each measured JS KB into `SCREENS` (round up to the next integer), each first-screen count into `BUDGET`, and set the dated comment. If a CLS or LCP fails: a CLS from a known cause this plan can fix cheaply (a skeleton at the wrong size, a font swap) gets fixed; otherwise record it as a finding for sub-project 4 and keep the assertion — do **not** raise `CLS_MAX` or `LCP_MAX`; if a route cannot pass on the runner even after the retry, take that route out of `SCREENS` with a one-line comment naming the measured number, so the gate stays honest rather than lax. Re-run until green.

Decide the "≤ 6 screens tall" rule from the printed `detail height`: if the recipe page is under 6 screens, add `expect(screens).toBeLessThanOrEqual(6)`; if not, add `expect(screens).toBeLessThanOrEqual(<measured, rounded up to one decimal>)` with the comment "measured 2026-10-23; AGENTS.md calls this a reading layout, so the cap is the measurement, only down".

- [ ] **Step 6: Run the gate's own tests** — `npx vitest run src/app/ci.test.ts && npm run typecheck && npm run lint` → PASS.

- [ ] **Step 7: Commit**

```bash
git add e2e/perf.spec.ts e2e/first-screen.spec.ts src/app/ci.test.ts
git commit -m "Gates: CLS, LCP and boot-JS budgets per screen, and the newcomer's first-screen counts, measured"
```

### Task 5: Pictures — `visual.spec.ts`, the PR-vs-base workflow, the label

**Files:**
- Create: `e2e/visual.spec.ts`, `.github/workflows/visual.yml`
- Modify: `src/app/ci.test.ts`
- Repository: the `visual-ok` label

**Interfaces:**
- Consumes: `SCREENS.visual`, `resolve`, `ready`, `routeAssetHosts`.

- [ ] **Step 1: Write the failing test** — append to `src/app/ci.test.ts`:

```ts
describe('the visual check', () => {
  it('is opt-in locally and compares PR with base on CI', () => {
    const spec = read('e2e/visual.spec.ts');
    expect(spec).toMatch(/test\.skip\(!process\.env\.CL_VISUAL/);
    expect(spec).toMatch(/animations: 'disabled'/);
    expect(spec).toMatch(/maxDiffPixelRatio: 0\.01/);
    const wf = read('.github/workflows/visual.yml');
    expect(wf).toMatch(/FRONT_PATHS: src public\/fonts messages packages\/colorlab-tokens e2e\/visual\.spec\.ts playwright\.config\.ts/);
    expect(wf).toMatch(/CL_VISUAL=1 CL_SNAPSHOT_DIR=/);
    expect(wf).toMatch(/--remove-label visual-ok/);
    expect(wf).not.toMatch(/E2E_DIR|WEB_DIR|FF_/);
  });
});
```

- [ ] **Step 2: Run it and see it fail** — `npx vitest run src/app/ci.test.ts` → FAIL.

- [ ] **Step 3: Create `e2e/visual.spec.ts`**

```ts
import { expect, test } from '@playwright/test';
import { SCREENS, ready, resolve, routeAssetHosts } from './setup.ts';

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
      await page.goto(path!);
      await ready(page);
      await expect(page).toHaveScreenshot(name(template, size.name), { fullPage: true, animations: 'disabled', caret: 'hide', maxDiffPixelRatio: 0.01 });
      // Regions where 1 % of a page is a whole changed element.
      if (template === '/recipe/:recipe') {
        await expect(page.locator('header').first()).toHaveScreenshot(`recipe-header-${size.name}.png`, { animations: 'disabled', maxDiffPixelRatio: 0.002 });
        await expect(page.locator('main h1').first()).toHaveScreenshot(`recipe-title-${size.name}.png`, { animations: 'disabled', maxDiffPixelRatio: 0.002 });
      }
    });
  }
}
```

If the recipe page's hero has a steadier wrapper than `main h1` (read `src/app/[locale]/recipe/[slug]/page.tsx` for the hero's element), shoot that element instead and say which.

- [ ] **Step 4: Create `.github/workflows/visual.yml`** — design-kit's `github/visual.yml` with: `FRONT_PATHS: src public/fonts messages packages/colorlab-tokens e2e/visual.spec.ts playwright.config.ts`; the `E2E_DIR`/`WEB_DIR` indirection removed (one package: paths are `head/` and `base/`); `cache-dependency-path` the two `package-lock.json`; install `for d in base head; do (cd "$d" && npm ci); done; cd head && npx playwright install --with-deps chromium`; shoot base with `cp head/e2e/visual.spec.ts base/e2e/visual.spec.ts; cp head/e2e/setup.ts base/e2e/setup.ts; cp head/playwright.config.ts base/playwright.config.ts; cd base && CL_VISUAL=1 CL_SNAPSHOT_DIR="$RUNNER_TEMP/visual" npx playwright test e2e/visual.spec.ts --update-snapshots`; compare in `head` with `CL_VISUAL=1 CL_SNAPSHOT_DIR="$RUNNER_TEMP/visual" npx playwright test e2e/visual.spec.ts --reporter=list,html`; artifact paths `head/test-results/` and `head/playwright-report/`; everything else (label handling, `ACCEPTED`, verdict) verbatim. `actions/checkout@v4` and `actions/setup-node@v4` as `ci.yml` uses (the kit pins v7; match this repo). Add `NEXT_PUBLIC_AUTH_SUPABASE_URL: ''` etc. is unnecessary: CI has no `.env.local`.

- [ ] **Step 5: Create the label** — `GH_TOKEN=$(gh auth token --user thaikpham) gh label create visual-ok --repo thaikpham/sonyalphacolorlab --color 5C74F0 --description "Ảnh so sánh đã xem; thay đổi là cố ý"`. (The active `gh` account is `kitsbui`, without access.)

- [ ] **Step 6: Run locally once** — `npm run test:visual -- --update-snapshots` to prove the spec runs (baselines land under `e2e/visual.spec.ts-snapshots/`, gitignored), then `npm run test:visual` → passes against them. Delete nothing; they stay ignored.

- [ ] **Step 7: Run the gate's own tests** — `npx vitest run src/app/ci.test.ts && npm run typecheck && npm run lint` → PASS.

- [ ] **Step 8: Commit**

```bash
git add e2e/visual.spec.ts .github/workflows/visual.yml src/app/ci.test.ts
git commit -m "Visual: the main screens shot on the PR and its base, compared on one runner, accepted with visual-ok"
```

### Task 6: The rest of DESIGN.md's audit as `floor.ts` rules

Six new rules, same mechanism: counted per file, recorded exactly, only down. The only allowlists are the filenames DESIGN.md already names.

**Files:**
- Modify: `src/design/floor.ts`, `src/design/floor.test.ts`, `src/design/floor.baseline.json`, `scripts/design-baseline.ts`

**Interfaces:**
- Produces: `Rule = 'belowFloor' | 'mono' | 'palette' | 'hex' | 'stroke' | 'deletedVocab' | 'scrollbarCss' | 'arbitraryPx' | 'duration'`; `Counts` and `totals()` cover all nine; `RULES: readonly Rule[]` exported for the baseline script.

- [ ] **Step 1: Write the failing tests** — in `floor.test.ts`, extend the `it.each` probe list with one sample per new rule and add a second `it.each` of samples that must **not** count:

```ts
      /* The six rules that used to be DESIGN.md's greps. */
      ['#8A9CFF', 'hex'],
      ['color: #fff', 'hex'],
      ['border-t-2', 'stroke'],
      ['ring-2', 'stroke'],
      ['outline-1', 'stroke'],
      ['border-solid', 'stroke'],
      ['className="eyebrow"', 'deletedVocab'],
      ['var(--font-display)', 'deletedVocab'],
      ['animate-radar-sweep', 'deletedVocab'],
      ['::-webkit-scrollbar { display: none }', 'scrollbarCss'],
      ['scrollbar-width: none', 'scrollbarCss'],
      ['h-[38px]', 'arbitraryPx'],
      ['duration-200', 'duration'],
      ['transition: opacity 0.18s ease', 'duration'],
```

and

```ts
    it.each([
      ['focus-visible:ring-2', 'stroke'],
      ['btn-glass', 'deletedVocab'],
      ['bg-glass-raised', 'deletedVocab'],
      ['var(--color-glass)', 'deletedVocab'],
      ['scroll-silent', 'scrollbarCss'],
      ['scroll-area', 'scrollbarCss'],
      ['#about', 'hex'],
      ['duration-(--motion)', 'duration'],
    ])('does not count %s as %s', (sample, rule) => {
      expect(scanSource(sample, 'src/components/x.tsx').filter((v) => v.rule === rule)).toEqual([])
    })

    it.each([
      ['src/app/icon.tsx', '#07080B', 'hex'],
      ['src/app/opengraph-image.tsx', '#07080B', 'hex'],
      ['src/app/manifest.ts', '#07080B', 'hex'],
      ['src/components/auth-context.tsx', 'themeColor: "#07080B"', 'hex'],
      ['src/app/globals.css', '::-webkit-scrollbar { width: 6px }', 'scrollbarCss'],
      ['src/app/globals.css', 'transition: opacity 0.18s ease', 'duration'],
      ['src/lib/camera/color.ts', '#8A9CFF', 'hex'],
    ])('does not count %s in %s (DESIGN.md names the exception)', (file, sample, rule) => {
      expect(scanSource(sample, file).filter((v) => v.rule === rule)).toEqual([])
    })
```

(`hex` is scoped to `src/components` and `src/app`, as the DESIGN.md grep is; `src/lib/camera/color.ts` is therefore out of scope and the last row checks that.) Read the existing probe test's shape first (`floor.test.ts:60-90`) and keep its `scanSource(sample, 'src/components/x.tsx')` call style.

- [ ] **Step 2: Run them and see them fail** — `npx vitest run src/design` → FAIL (unknown rules).

- [ ] **Step 3: Implement in `floor.ts`**

```ts
export type Rule =
  | 'belowFloor' | 'mono' | 'palette'
  | 'hex' | 'stroke' | 'deletedVocab' | 'scrollbarCss' | 'arbitraryPx' | 'duration'

export const RULES: readonly Rule[] = [
  'belowFloor', 'mono', 'palette', 'hex', 'stroke', 'deletedVocab', 'scrollbarCss', 'arbitraryPx', 'duration',
]
```

Patterns, after `PALETTE`:

```ts
/**
 * The six rules that were DESIGN.md's audit greps, so `/design-sync` runs as a
 * test instead of as something a person remembers.
 *
 * `hex`: a colour written as a hex literal, in a component or a route. Scoped
 * to `src/components` and `src/app` as the grep was; the token source and
 * `lib/camera/color.ts` compute colour and are out of scope. DESIGN.md names
 * the files that may carry one (Satori ignores `oklch()`; the web manifest and
 * `themeColor` are read by the OS; Google's mark is Google's), and those are
 * the only exceptions — by filename, never by a per-line escape.
 */
const HEX = /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{4}|[0-9a-f]{3})(?![\w-])/gi
const HEX_SCOPE = /^src\/(components|app)\//
const HEX_FILES = new Set(['src/app/icon.tsx', 'src/app/opengraph-image.tsx', 'src/app/manifest.ts'])
const HEX_LINE = /themeColor|GoogleMark/

/** A stroke doing elevation's job (rule 4). Only `:focus-visible` may draw one. */
const STROKE = /\b(?:border(?:-[trblxyse])?-\d+|border-(?:solid|white|black)|ring-\d+|outline-\d+)\b/g
const STROKE_LINE = /focus-visible:/

/** DESIGN.md "Deleted — do not reintroduce", minus the four survivors CLAUDE.md names. */
const DELETED =
  /\b(?:glass-flat|eyebrow|y2k-[\w-]*|holo-[\w-]*|water-[\w-]*|cyber-[\w-]*|animate-radar-[\w-]*|app-glow|rainbow-glow-bar|animate-float-gentle|vfx\.css)\b|--font-mono\b|--font-display\b|--color-edge\b|\.rule\b|(?<![\w-])glass(?![\w-])/g

/** Scrollbar CSS anywhere but globals.css (rule 6). The two class names are the sanctioned API. */
const SCROLLBAR = /::-webkit-scrollbar|\bscrollbar(?!-(?:silent|area|table))/g
const SCROLLBAR_FILE = 'src/app/globals.css'

/** An arbitrary pixel value in a class name. The count is the budget. */
const ARBITRARY_PX = /\[-?\d+(?:\.\d+)?px\]/g

/**
 * A duration of its own (D1, 2026-10-23): a `duration-<n>` class in a
 * component, or a `transition` with a time in a stylesheet. CLAUDE.md §Motion
 * allows `.animate-fade-in` and the launcher glow, both in globals.css, which
 * is the one file whose transitions are not counted.
 */
const DURATION_CLASS = /(?<![\w-])duration-\d+\b/g
const RAW_TRANSITION = /\btransition(?:-duration)?\s*:[^;{}]*?(?<![\w-])\d*\.?\d+m?s\b/g
```

In `scanSource`, after the palette collect, add (where `lines` helps the per-line allowlists — implement a small `lineText(code, index)` helper that returns the line containing `index`):

```ts
    ...(HEX_SCOPE.test(file) && !HEX_FILES.has(file)
      ? collect(code, file, HEX, 'hex', (m) => !HEX_LINE.test(lineText(code, m.index)))
      : []),
    ...collect(code, file, STROKE, 'stroke', (m) => !STROKE_LINE.test(lineText(code, m.index))),
    ...collect(code, file, DELETED, 'deletedVocab', (m) => !/\bbtn-glass\b|\bglass-raised\b|\bbg-glass\b|--color-glass\b/.test(lineText(code, m.index)) || !/^glass$/.test(m[0])),
    ...(file === SCROLLBAR_FILE ? [] : collect(code, file, SCROLLBAR, 'scrollbarCss')),
    ...(file.endsWith('.tsx') ? collect(code, file, ARBITRARY_PX, 'arbitraryPx') : []),
    ...(file.endsWith('.tsx') ? collect(code, file, DURATION_CLASS, 'duration') : []),
    ...(file.endsWith('.css') && file !== SCROLLBAR_FILE ? collect(code, file, RAW_TRANSITION, 'duration') : []),
```

The `deletedVocab` accept is subtle — simplify it: match bare `glass` only when the line does not contain one of the four survivors; every other deleted name counts regardless. Write it as a named function `deletedAccept(code)` returning `(m) => m[0] !== 'glass' || !SURVIVORS.test(lineText(code, m.index))` with `const SURVIVORS = /btn-glass|glass-raised|bg-glass|--color-glass/`.

`tally()` and `totals()` build their zero record from `RULES` (`Object.fromEntries(RULES.map((r) => [r, 0]))`) instead of the three literal keys. `Counts` stays `Readonly<Record<Rule, number>>`.

- [ ] **Step 4: Regenerate the baseline** — `npm run design:baseline`, and change `scripts/design-baseline.ts` to print one line per rule from `RULES` instead of the three hard-coded lines. Read the diff of `floor.baseline.json`: every file now lists nine counts; the new counts are today's debt (expected roughly: hex 9, stroke 1, deletedVocab ~27 of which most are the bare `glass` in comments — verify `stripComments` removed them; scrollbarCss ~24 before the `globals.css` exemption and the two class names; arbitraryPx 57+; duration 23). If a count is obviously a false positive (a comment the stripper missed, a word in prose), fix the pattern, not the baseline.

- [ ] **Step 5: Run** — `npx vitest run src/design && npm run typecheck && npm run lint` → PASS.

- [ ] **Step 6: Commit**

```bash
git add src/design scripts/design-baseline.ts
git commit -m "Design floor: hex, strokes, deleted vocabulary, scrollbar CSS, arbitrary px and durations join the exact baseline"
```

### Task 7: The PR template and the parsed checklist

**Files:**
- Create: `.github/pull_request_template.md`, `.github/scripts/design-checklist.mjs`, `.github/workflows/design-checklist.yml`, `scripts/design-checklist.test.ts`

- [ ] **Step 1: Write the failing test** — `scripts/design-checklist.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { problems } from '../.github/scripts/design-checklist.mjs'

/**
 * The checklist a PR carries (`.github/pull_request_template.md`, section
 * "## Thiết kế") is a merge condition: every box ticked, or the first one,
 * "Không đổi giao diện". The parser is thirty lines; this is what keeps a
 * reworded template and the parser in step.
 */
const template = readFileSync('.github/pull_request_template.md', 'utf8')
const tick = (body: string) => body.replace(/- \[ \]/g, '- [x]')

describe('the design checklist', () => {
  it('refuses the template as shipped (nothing ticked)', () => {
    expect(problems(template).length).toBeGreaterThan(0)
  })

  it('accepts every box ticked', () => {
    expect(problems(tick(template))).toEqual([])
  })

  it('accepts "Không đổi giao diện" alone', () => {
    const body = template.replace('- [ ] Không đổi giao diện', '- [x] Không đổi giao diện')
    expect(problems(body)).toEqual([])
  })

  it('names each box left unticked', () => {
    const body = tick(template).replace('- [x] Ba trạng thái', '- [ ] Ba trạng thái')
    expect(problems(body)).toEqual([expect.stringContaining('Ba trạng thái')])
  })

  it('reads an English heading too', () => {
    const body = tick(template).replace('## Thiết kế', '## Design')
    expect(problems(body)).toEqual([])
  })

  it('asks for the section when it is missing', () => {
    expect(problems('## Thay đổi\n\nx')).toEqual([expect.stringContaining('Thiết kế')])
  })

  it('ignores the HTML comments the template carries', () => {
    expect(problems(tick(template).replace('<!--', '<!-- - [ ] fake '))).toEqual([])
  })
})
```

vitest includes `scripts/**/*.test.ts`; importing a `.mjs` from a `.ts` test works under vitest's ESM. If `tsc --noEmit` complains about the `.mjs` import's types, add `// @ts-expect-error — plain ESM script, run by GitHub Actions` above the import rather than a `.d.ts`.

- [ ] **Step 2: Run it and see it fail** — `npx vitest run scripts/design-checklist.test.ts` → FAIL (no module).

- [ ] **Step 3: Create `.github/scripts/design-checklist.mjs`** — design-kit's, with the two regexes:

```js
const HEAD = /^##\s+(?:Thiết kế|Design)\s*$/m;
const NONE = /không đổi giao diện|no (?:ui|visual) change/i;
```

and the comment's first line naming this repo's test (`scripts/design-checklist.test.ts`). Everything else verbatim.

- [ ] **Step 4: Create `.github/pull_request_template.md`**

```markdown
## Thay đổi

<!-- Một hai câu: thay đổi gì, vì sao. Ảnh 390 và 1440 nếu đổi giao diện. -->

## Kiểm tra

- [ ] `npm run verify` (lint, typecheck, test, build)
- [ ] `npm run test:screens` (layout 390/768/1440, axe, vùng chạm 44px, CLS/JS/LCP, màn đầu)

## Thiết kế

<!-- Bắt buộc khi PR đổi src/, messages/, public/fonts/ hoặc packages/colorlab-tokens/ (design-checklist.yml). Đánh dấu mục đầu nếu không đổi giao diện. Chi tiết: docs/DESIGN_GOVERNANCE.md. -->

- [ ] Không đổi giao diện
- [ ] Một `.btn-accent` mỗi màn hình; màu theo token, không hex, không palette Tailwind (`floor.test.ts` xanh)
- [ ] Vừa 390 / 768 / 1440, không cuộn ngang ngoài `.scroll-silent` / `.filter-scroll` / `.scroll-area` / `.scroll-table`
- [ ] Không dòng giải thích; mọi chuỗi trong `messages/*.json` ở cả hai ngôn ngữ
- [ ] Không stroke, chữ luôn sáng hơn nền, elevation dùng nguyên khối
- [ ] Ba trạng thái: đang tải đúng kích thước, rỗng có việc để làm, lỗi có thử lại
- [ ] Trợ năng: tên đọc được bắt đầu bằng chữ hiển thị, vùng chạm 44px, `:focus-visible` thấy được, sheet trả focus
- [ ] Màn mới có trong `e2e/setup.ts`
- [ ] Màn đầu không tăng số chỗ bấm; không tên nội bộ ở màn đầu
- [ ] Ảnh so sánh: không đổi, hoặc đã xem `visual-diff` và gắn `visual-ok`
```

- [ ] **Step 5: Create `.github/workflows/design-checklist.yml`** — design-kit's, with `FRONT_PATHS: src public/fonts messages packages/colorlab-tokens` and `actions/checkout@v4`.

- [ ] **Step 6: Run** — `npx vitest run scripts/design-checklist.test.ts && npm run typecheck && npm run lint` → PASS. (ESLint may lint the `.mjs`; if it flags the `import.meta.url` main-module check, keep the code and add the file to no ignore list — fix the rule's complaint instead.)

- [ ] **Step 7: Commit**

```bash
git add .github/pull_request_template.md .github/scripts/design-checklist.mjs .github/workflows/design-checklist.yml scripts/design-checklist.test.ts
git commit -m "PR template with a design checklist, parsed on every pull request that touches the front"
```

### Task 8: CI — the `screens` job

**Files:**
- Modify: `.github/workflows/ci.yml`, `src/app/ci.test.ts`

- [ ] **Step 1: Write the failing test** — append to `src/app/ci.test.ts`:

```ts
describe('.github/workflows/ci.yml', () => {
  const wf = read('.github/workflows/ci.yml');
  it('runs the browser gates as their own job and builds once in verify', () => {
    expect(wf).toMatch(/^\s{2}screens:/m);
    expect(wf).toMatch(/npx playwright install --with-deps chromium/);
    expect(wf).toMatch(/npm run test:screens/);
    expect(wf).toMatch(/path: \.next\/cache/);
    expect(wf).toMatch(/actions\/upload-artifact/);
    /* `verify` already builds; the second build cost two minutes a run and
       proved nothing new. */
    expect(wf.match(/run: npm run build/g) ?? []).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run it and see it fail** — `npx vitest run src/app/ci.test.ts` → FAIL.

- [ ] **Step 3: Edit `ci.yml`** — delete the trailing `- name: Build / run: npm run build` step of `verify` (and amend the comment above "Verify" to say it builds). Add, after the `verify` job:

```yaml
  # The browser gates (e2e/): a fresh production build in seed mode, then
  # layout at three widths, axe, 44px targets, CLS/JS/LCP budgets and the
  # first-screen counts. Its own job so `verify` stays the two-minute gate a
  # developer runs on every change; this one is what a design change waits
  # for. One runner until a run passes eight minutes, then shard by file.
  screens:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm

      - name: Install dependencies
        run: npm ci

      # The Chromium that matches the Playwright version in the lockfile.
      - name: Install browsers
        run: npx playwright install --with-deps chromium

      # Next's own build cache, kept between runs: a run rebuilds only what changed.
      - name: Next build cache
        uses: actions/cache@v4
        with:
          path: .next/cache
          key: next-build-${{ runner.os }}-${{ hashFiles('package-lock.json') }}-${{ hashFiles('src/**', 'messages/**', 'packages/**', 'next.config.ts') }}
          restore-keys: |
            next-build-${{ runner.os }}-${{ hashFiles('package-lock.json') }}-

      - name: Screens
        run: npm run test:screens
        env:
          NEXT_TELEMETRY_DISABLED: '1'

      - name: Keep the traces of failed tests
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-screens
          path: test-results/
          retention-days: 7
```

- [ ] **Step 4: Run** — `npx vitest run src/app/ci.test.ts` → PASS. Validate the YAML parses: `node -e "require('yaml')"` is not a dependency; use `npx --yes yaml@2 --help >/dev/null 2>&1; python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/ci.yml')); yaml.safe_load(open('.github/workflows/visual.yml')); yaml.safe_load(open('.github/workflows/design-checklist.yml')); print('yaml ok')"`.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/ci.yml src/app/ci.test.ts
git commit -m "CI: the browser gates as a screens job beside verify, which builds once"
```

### Task 9: Documents

**Files:**
- Create: `docs/DESIGN_GOVERNANCE.md`
- Modify: `DESIGN.md` (§Audit), `.claude/commands/design-sync.md`, `docs/design-tooling.md`, `AGENTS.md`

- [ ] **Step 1: `docs/DESIGN_GOVERNANCE.md`**

```markdown
# Design governance — what gates a change, and what a 9 means

## The gates

| Gate | Where it runs | What fails it |
|---|---|---|
| `src/design/floor.test.ts` | `npm test`, `verify` | a count in `floor.baseline.json` went up: type under 13px, a second font, a Tailwind palette colour, a hex in a component, a stroke outside `:focus-visible`, deleted vocabulary, scrollbar CSS outside `globals.css`, an arbitrary `[Npx]`, a duration of its own |
| `token-drift`, `fonts`, `messages` tests | `npm test` | a generated token copy out of step, a missing Vietnamese subset, a string in one locale only, a namespace shipped unread |
| `e2e/layout.spec.ts` | `test:screens`, CI `screens` | a page wider than 390 / 768 / 1440, or a box scrolling sideways outside `.scroll-silent` / `.filter-scroll` / `.scroll-area` / `.scroll-table` |
| `e2e/wcag.spec.ts` | same | a serious or critical WCAG 2.1 A/AA violation over the route's count in `e2e/budgets.json`; an uncaught error, a console error, a 5xx |
| `e2e/targets.spec.ts` | same | a tap target under 44 × 44 px at 390 over the route's count |
| `e2e/perf.spec.ts` | same | CLS > 0.05, LCP > 2.5 s, or boot JS over the screen's budget, on a 4× CPU / 4G phone |
| `e2e/first-screen.spec.ts` | same | more controls in sight at 390×844 on `/colorlab` or a recipe page than the budget |
| `Visual` workflow | every PR touching `src`, `messages`, `public/fonts`, `packages/colorlab-tokens` | a screen differs from the base branch and the PR has no `visual-ok` label (a new push removes it) |
| `Design checklist` workflow | same PRs | a box in "## Thiết kế" left unticked, unless "Không đổi giao diện" is ticked |

Budgets only go down. A number in `e2e/budgets.json`, `e2e/perf.spec.ts`,
`e2e/first-screen.spec.ts` or `src/design/floor.baseline.json` is what was
measured on the date beside it; lower it in the same PR as the change that
earns it; never raise it. A gate that blocks a good change is fixed in that
PR, with the reason in the commit.

## What a 9 means

Three columns, none of which replaces another (design-kit, FeestFinder
2026-10-18: 8.5 by the gates became 7 when a newcomer was measured):

1. Every gate above is green.
2. Five real people each do three tasks without help: find a recipe for their
   own body and reach its settings table; compare two cameras in the Wiki and
   say which they would buy; read a learn page and say what the parameter
   does. Timed, on their own phone.
3. Two weeks of real numbers after the change (Vercel Analytics / Web Vitals
   p75: LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1) no worse than before.

## A pull request

Branch → code, tests and docs in one commit → `npm run verify`, and
`npm run test:screens` for anything on screen → PR from the template with the
checklist ticked truthfully → `Visual` red is normal for an intended change:
open the `visual-diff` artifact, look, add `visual-ok` → merge on the owner's
word → the merge builds production (Vercel) → look at the live page on a
phone.
```

- [ ] **Step 2: `DESIGN.md` §Audit** — replace the grep list with one paragraph: the eight greps are `src/design/floor.test.ts` now (name the nine rules), `npm test` runs it, `npm run design:baseline` records a drop; keep the sentence "Every hit is a defect. Fix it or delete it; do not add an exception." Add one line: "What a grep cannot see runs in a browser: `npm run test:screens` (`e2e/`), described in `docs/DESIGN_GOVERNANCE.md`." Keep §Fonts.

- [ ] **Step 3: `.claude/commands/design-sync.md`** — step 2 becomes: run `npx vitest run src/design` and read any failure; then the five things a scanner cannot see (keep that list). Add a step 0: "Measure: `npm run test:screens` — read the first-screen and perf tables it prints and the per-route lists; a number that went down is lowered in `e2e/budgets.json` / the spec, in this change." Step 4 adds `npm run test:screens` when anything on screen changed.

- [ ] **Step 4: `docs/design-tooling.md`** — "The gate, unchanged" → "The gate": `npm run verify` (two minutes), `npm run test:screens` (ten, for anything on screen), `npm run test:visual` (opt-in, local baselines), with the sentence "A design change is finished when the first two pass and `Visual` has been looked at" replacing the screenshot sentence.

- [ ] **Step 5: `AGENTS.md`** — in the command block add:

```bash
npm run test:screens   # browser gates (e2e/): fresh seed-mode build on :3100, ~10 min — CI runs it as its own job
npm run verify:screens # verify + test:screens, before a PR that touches the screen
```

and under "## Working style" add:

```markdown
- **Gates measure; budgets only go down.** `e2e/budgets.json`, the numbers in
  `e2e/perf.spec.ts` and `e2e/first-screen.spec.ts`, and
  `src/design/floor.baseline.json` are measurements with a date. Lower one in
  the same PR as the fix; never raise one; a gate that blocks a good change is
  fixed in that PR with the reason. Check `echo $?` after `npm run lint` and
  never pipe it inside an `&&` chain; the gates pin `timezoneId: 'UTC'`; a
  screenshot or a count from a stale build decides nothing — rebuild; when one
  browser gate fails, run the whole `test:screens` (specs share the server).
```

- [ ] **Step 6: Run** — `npm test && npm run lint` (the `messages.test.ts` leaf-key check reads `docs/` too? It reads `src`, `scripts`; fine) → PASS.

- [ ] **Step 7: Commit**

```bash
git add docs/DESIGN_GOVERNANCE.md DESIGN.md .claude/commands/design-sync.md docs/design-tooling.md AGENTS.md
git commit -m "Docs: the gates, what a 9 means, and the only-down budget rule"
```

### Task 10: The whole gate, then the hand-off

- [ ] **Step 1: The full local run** — `npm run verify:screens` (one build in `verify`, one in the Playwright web server — the second in seed mode; accept the duplicate for now). Expected: green. Copy the perf and first-screen tables and the `budgets.json` totals into the task report.

- [ ] **Step 2: The design audit on the branch's files** — the seven greps of CLAUDE.md over `git diff --name-only $(git merge-base main HEAD) HEAD`, and `npx vitest run src/design`. Every hit in a file this plan added is fixed.

- [ ] **Step 3: Push and open the PR** — `git push git@github.com:thaikpham/sonyalphacolorlab.git claude/design-gates`, then `GH_TOKEN=$(gh auth token --user thaikpham) gh pr create --repo thaikpham/sonyalphacolorlab --base main --head claude/design-gates --title "Browser gates and the PR checklist" --body-file <body>`. The body follows the new template: fill `## Thay đổi` with the summary and the measured tables, tick `## Kiểm tra`, and in `## Thiết kế` tick **Không đổi giao diện** (the only on-screen change is `.scroll-table`, which renders identically) — this PR is the first the checklist action reads. Attribution footer `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

- [ ] **Step 4: Watch the four checks** — `verify`, `screens`, `Design checklist`, `Visual (PR vs base)` — through the app's PR status, not by polling. `Visual` on this PR compares the base (no `e2e/`) with the PR: the base-side shoot has no spec file to copy… the workflow copies `head/e2e/visual.spec.ts` into `base/e2e/`, so the base shoot runs the PR's spec against the base build. Expected: pictures identical except where `.scroll-table` changed nothing visible → green; if the compare table's scrollbar region differs by a pixel, look, then `visual-ok`.

- [ ] **Step 5: Report to the owner** — the measured numbers (first-screen counts against design-kit's ≤ 12 / ≤ 7 targets, boot JS per screen against FeestFinder's 171–210 KB, CLS, LCP), the per-route debts in `budgets.json` as the to-do for sub-project 5, the CI duration of the `screens` job, and the branch-protection step the owner enables after a few green PRs (`verify`, `screens`, `Design checklist`, `Visual (PR vs base)` required).

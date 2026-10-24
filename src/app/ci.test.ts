import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { ROUTES } from '../../e2e/setup';

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

  /* `.next/cache/fetch-cache` survives a build and the next build is served
     its entries instead of calling the read: a seed build straight after a
     live `npm run verify` prerendered the live catalogue (2026-10-24). The
     clear must come before the build, in the same command. */
  it('clears the data cache before the build, so seed mode never inherits a live build', () => {
    expect(src).toMatch(
      /node -e "require\('fs'\)\.rmSync\('\.next\/cache\/fetch-cache',\{recursive:true,force:true\}\)"/,
    );
    expect(src).toMatch(/command: `\$\{CLEAR_DATA_CACHE\} && \$\{/);
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

describe('e2e/checks.ts', () => {
  const src = read('e2e/checks.ts');
  it('exempts only the sanctioned containers from the box rule, and nothing from the page rule', () => {
    expect(src).toMatch(/closest\(EXEMPT_SCROLL\)/);
    expect(src).toMatch(/doc\.scrollWidth > W \+ 1/);
  });

  /* One definition each: a spec that grew its own copy would be a checker the
     probes in checkers.spec.ts never see. */
  it('is the only home of the four checkers, and checkers.spec.ts probes all four', () => {
    for (const fn of ['axe', 'overflow', 'small', 'inSight']) {
      expect(src, fn).toMatch(new RegExp(`export async function ${fn}\\(`));
    }
    for (const spec of ['layout', 'targets', 'wcag', 'first-screen']) {
      expect(read(`e2e/${spec}.spec.ts`), spec).not.toMatch(/async function (axe|overflow|small|inSight)\(|new AxeBuilder/);
    }
    const probes = read('e2e/checkers.spec.ts');
    expect(probes).toMatch(/import \{ axe, inSight, overflow, small \} from '\.\/checks\.ts'/);
    expect(probes).toMatch(/setContent/);
  });
});

describe('e2e/budgets.ts', () => {
  it('matches a count exactly and says which way it moved', () => {
    const src = read('e2e/budgets.ts');
    expect(src).toMatch(/return found\.length === budget;/);
    expect(src).toMatch(/— fix it/);
    expect(src).toMatch(/— lower e2e\/budgets\.json to \$\{found\.length\}/);
    const first = read('e2e/first-screen.spec.ts');
    expect(first).toMatch(/toBe\(BUDGET\.list\)/);
    expect(first).toMatch(/toBe\(BUDGET\.detail\)/);
  });
});

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

  /* A key the walk never visits is a budget nothing checks: it outlives the
     route or the instance it was measured on and reads as debt still owed.
     The instance ids come from the sitemap at run time, so the key's id is
     put back as the template's placeholder; and one template is walked with
     one instance, so it may carry one id. */
  it('names only routes the walk visits, at widths that kind measures', () => {
    const WIDTHS: Record<string, string[] | null> = { axe: ['phone', 'desktop'], layout: ['phone', 'tablet', 'desktop'], targets: null };
    const templates = ROUTES.visitor.map((t) => ({
      t,
      re: new RegExp(`^${t.replace(/[.?*+^$()[\]{}|\\]/g, '\\$&').replace(/:[a-z]+/g, '([^/?]+)')}$`),
    }));
    for (const [kind, widths] of Object.entries(WIDTHS)) {
      const ids = new Map<string, Set<string>>();
      for (const key of Object.keys(budgets[kind] ?? {})) {
        let path = key;
        if (widths) {
          const m = /^(.*) · (\w+)$/.exec(key);
          expect(m, `${kind} "${key}" has no " · <width>"`).not.toBeNull();
          expect(widths, `${kind} "${key}"`).toContain(m![2]);
          path = m![1];
        } else expect(key, `${kind} "${key}" carries a width`).not.toMatch(/ · /);
        const literal = ROUTES.visitor.includes(path);
        const hit = templates.find(({ t, re }) => t.includes(':') && re.test(path));
        expect(literal || !!hit, `${kind} "${key}": ${path} is not a walked route`).toBe(true);
        if (!literal && hit) {
          const generic = hit.t.replace(/^\/vi(?=\/)/, '');
          ids.set(generic, (ids.get(generic) ?? new Set()).add(hit.re.exec(path)![1]));
        }
      }
      for (const [t, set] of ids) expect([...set], `${kind} ${t} names more than one instance`).toHaveLength(1);
    }
  });
});

describe('e2e/wcag.spec.ts and targets.spec.ts', () => {
  it('fail on faults a page can hide, and read their budgets from one file', () => {
    const wcag = read('e2e/wcag.spec.ts');
    expect(wcag).toMatch(/watch\(page\)/);
    expect(read('e2e/checks.ts')).toMatch(/withTags\(AXE_TAGS\)/);
    expect(wcag).toMatch(/report\('axe'/);
    /* Per width, like axe: a phone-only overflow must not buy a desktop one. */
    expect(read('e2e/layout.spec.ts')).toMatch(/report\('layout', `\$\{path\} · \$\{size\.name\}`/);
    const targets = read('e2e/targets.spec.ts');
    expect(read('e2e/checks.ts')).toMatch(/export const MIN_TARGET = 44/);
    expect(targets).toMatch(/report\('targets'/);
  });
});

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
    expect(src).not.toMatch(/\b999\b/);
  });
});

describe('e2e/first-screen.spec.ts', () => {
  const src = read('e2e/first-screen.spec.ts');
  it('counts the parameter rows apart from the controls, and has measured budgets', () => {
    expect(read('e2e/checks.ts')).toMatch(/details\.param-row > summary/);
    /* 99 is the "measure me" value. */
    const budget = /const BUDGET = \{[^}]*\}/.exec(src)?.[0];
    expect(budget).toBeDefined();
    expect(budget).not.toMatch(/: 99\b/);
  });
  it('holds no ceiling on parameter rows in sight: they are content', () => {
    expect(src).not.toMatch(/detailRows/);
  });
});

describe('the visual check', () => {
  it('is opt-in locally and compares PR with base on CI', () => {
    const spec = read('e2e/visual.spec.ts');
    expect(spec).toMatch(/test\.skip\(!process\.env\.CL_VISUAL/);
    expect(spec).toMatch(/animations: 'disabled'/);
    expect(spec).toMatch(/maxDiffPixelRatio: 0\.01/);
    const wf = read('.github/workflows/visual.yml');
    expect(wf).toMatch(/FRONT_PATHS: src public\/fonts messages packages\/colorlab-tokens e2e\/visual\.spec\.ts playwright\.config\.ts/);
    expect(wf).toMatch(/CL_VISUAL=1 CL_SNAPSHOT_DIR=/);
    expect(wf).toMatch(/gh api -X DELETE "repos\/\$REPO\/issues\/\$PR\/labels\/visual-ok"/);
    expect(wf).not.toMatch(/E2E_DIR|WEB_DIR|FF_/);
  });

  it('runs the comparison on every event: a skipped run under its name could read as passing', () => {
    const wf = read('.github/workflows/visual.yml');
    const job = /\n  visual:\n([\s\S]*?)\n    steps:/.exec(wf)?.[1];
    expect(job).toBeDefined();
    expect(job).not.toMatch(/^    if:/m);
    expect(job).not.toMatch(/pull-requests: write/);
  });
});

describe('.github/workflows/ci.yml', () => {
  const wf = read('.github/workflows/ci.yml');
  it('runs the browser gates as their own job and builds once in verify', () => {
    expect(wf).toMatch(/^\s{2}screens:/m);
    expect(wf).toMatch(/npx playwright install --with-deps chromium/);
    expect(wf).toMatch(/npm run test:screens/);
    /* The compiler cache only. The data cache beside it would carry a past
       run's answers into this build (playwright.config.ts clears it too). */
    expect(wf).toMatch(/path: \.next\/cache\/turbopack$/m);
    expect(wf).not.toMatch(/path: \.next\/cache$/m);
    expect(wf).toMatch(/actions\/upload-artifact/);
    /* `verify` already builds; a second build of the same tree proved
       nothing new. */
    expect(wf.match(/run: npm run build/g) ?? []).toHaveLength(0);
  });

  /* A push to a branch with an open PR fires `push` and `pull_request`; the
     gates are four minutes of one tree, so they run once, on the PR (and on
     main). A hung server must not hold a runner for the default six hours. */
  it('runs the screens job on pull requests and main only, with a timeout', () => {
    const job = /\n  screens:\n([\s\S]*?)\n    steps:/.exec(wf)?.[1];
    expect(job).toBeDefined();
    expect(job).toMatch(/^    if: github\.event_name == 'pull_request' \|\| github\.ref == 'refs\/heads\/main'$/m);
    expect(job).toMatch(/^    timeout-minutes: 20$/m);
  });
});

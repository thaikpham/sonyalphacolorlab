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
    expect(src).toMatch(/details\.param-row > summary/);
    /* 99 is the "measure me" value. */
    const budget = /const BUDGET = \{[^}]*\}/.exec(src)?.[0];
    expect(budget).toBeDefined();
    expect(budget).not.toMatch(/: 99\b/);
  });
  it('holds no ceiling on parameter rows in sight: they are content', () => {
    expect(src).not.toMatch(/detailRows/);
  });
});

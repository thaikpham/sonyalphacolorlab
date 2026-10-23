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

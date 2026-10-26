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
const CLEAR_DATA_CACHE = `node -e "require('fs').rmSync('.next/cache/fetch-cache',{recursive:true,force:true})"`;

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
    // Literal by default so the port a production run binds to is pinned at
    // the source, not merely parameterized away; SCREENS_PORT only switches
    // this to the dynamic form, for the one-off case where :3100 is already
    // taken by something this run didn't start (implementer-rules.md).
    //
    // The data cache goes first. `.next/cache/fetch-cache` holds every
    // `unstable_cache` answer (`catalogueCache`, `getPublishedEntries`) and
    // outlives a build; the next build is served what it finds there instead
    // of calling the read, whatever mode it runs in. So a seed build straight
    // after `npm run verify` (which builds against `.env.local`, the live
    // projects) prerendered the live catalogue: the sitemap listed
    // `/recipe/vv-khong` first, not the seed's `mojave-sun`, and the gates
    // measured live data while calling it seed mode (2026-10-24). FeestFinder's
    // `playwright.next.config.ts` clears the same folder for the same reason.
    // `node -e` rather than `rm -rf` so the command runs on Windows too.
    command: `${CLEAR_DATA_CACHE} && ${
      process.env.SCREENS_PORT
        ? `npm run build && npx next start --port ${PORT}`
        : 'npm run build && npx next start --port 3100'
    }`,
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

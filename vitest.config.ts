import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    /* Replaces the `vite-tsconfig-paths` plugin, which Vite has made redundant:
       every run printed "The plugin vite-tsconfig-paths is detected. Vite now
       supports tsconfig paths resolution natively" before the first test. A
       warning nobody can act on is a warning everybody learns to scroll past. */
    tsconfigPaths: true,
    alias: {
      // `server-only` throws outside a React Server Component. It is a build-time
      // guard, not runtime behaviour, so stub it rather than exclude every module
      // that (correctly) declares itself server-only.
      //
      // fileURLToPath, not URL.pathname — the project path contains a space and
      // pathname percent-encodes it into a path that does not exist.
      'server-only': fileURLToPath(new URL('./src/test/server-only-stub.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    // packages/ holds the shared design-token source; its drift test is what
    // keeps this app's vendored copy honest.
    include: ['src/**/*.test.ts', 'packages/**/*.test.ts'],
  },
});

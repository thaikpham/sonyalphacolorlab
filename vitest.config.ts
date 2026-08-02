import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
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
    // keeps the two sibling apps from diverging from this one.
    include: ['src/**/*.test.ts', 'packages/**/*.test.ts'],
  },
});

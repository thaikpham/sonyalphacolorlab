import { viteReactConfig } from '@colorlab/eslint-config/vite-react'

// Serverless functions, tests and build config run in Node, not the browser.
export default viteReactConfig({
  nodeFiles: ['api/**/*.ts', 'tests/**/*.ts', 'vite.config.ts', 'vitest.config.ts'],
})

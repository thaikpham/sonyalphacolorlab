import { viteReactConfig } from '@colorlab/eslint-config/vite-react'

export default viteReactConfig({
  nodeFiles: ['tests/**/*.ts', 'vite.config.ts', 'vitest.config.ts'],
})

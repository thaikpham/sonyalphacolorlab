/**
 * Shared ESLint base for the two Vite + React apps.
 *
 * This exists because the copy-paste it replaces caused a real outage of the
 * lint gate. `eslint.config.js` was copied from CheeseBooth into Live SOP
 * without bumping `eslint-plugin-react-hooks` alongside it, so
 * `reactHooks.configs.flat` was `undefined` on the older plugin and the config
 * threw on load. `npm run lint` had never once completed in that app — and a
 * command that always errors is indistinguishable, day to day, from a command
 * that always passes. Twenty-three real violations were hiding behind it,
 * including four genuine React bugs.
 *
 * With the config in a workspace package and the plugins resolved from one
 * lockfile, that specific failure cannot recur: there is no second copy to
 * fall behind.
 *
 * ColorLab does not use this. It is a Next.js app and extends
 * `eslint-config-next`, which brings its own React rules; sharing a base
 * between the two would mean reconciling two rule sets to no benefit.
 */

import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

/**
 * @param {object} [options]
 * @param {string[]} [options.nodeFiles]
 *   Globs that run in Node rather than the browser — serverless functions,
 *   tests, build config. They skip the React rules and get Node globals.
 * @param {string[]} [options.ignores] Extra paths to ignore.
 */
export function viteReactConfig({ nodeFiles = [], ignores = [] } = {}) {
  return defineConfig([
    globalIgnores(['dist', ...ignores]),
    {
      files: ['src/**/*.{ts,tsx}'],
      extends: [
        js.configs.recommended,
        tseslint.configs.recommended,
        // `configs.flat` needs eslint-plugin-react-hooks >= 7. On 5.x it is
        // undefined and the whole config throws — see the note at the top.
        reactHooks.configs.flat.recommended,
        reactRefresh.configs.vite,
      ],
      languageOptions: {
        globals: globals.browser,
      },
    },
    ...(nodeFiles.length
      ? [
          {
            files: nodeFiles,
            extends: [js.configs.recommended, tseslint.configs.recommended],
            languageOptions: {
              globals: { ...globals.browser, ...globals.node },
            },
          },
        ]
      : []),
  ])
}

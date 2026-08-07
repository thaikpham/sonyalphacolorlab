import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Verbatim copy of the original sonycolorlab dataset; deleted after cutover.
    "src/lib/legacy/*.legacy.js",
    /* Separate apps that happen to sit in this folder — they are gitignored and
       excluded from tsconfig, and they are not this project's code to fix.
       Without these, `npm run lint` reports ~4.6k problems from them and buries
       the handful that are actually ours. */
    "apps/cheese-booth/**",
    "apps/live-sop/**",
  ]),
  {
    rules: {
      // `_name` marks a binding that exists only to be destructured away.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
    },
  },
]);

export default eslintConfig;

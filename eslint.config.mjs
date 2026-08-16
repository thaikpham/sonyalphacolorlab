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
    /* The design handoff bundle: HTML prototypes plus the vendored runtime
       that renders them standalone. It is reference material, not source —
       nothing here is imported, built or shipped, and linting someone else's
       prototype runtime failed the gate on a deprecated `ReactDOM.render`
       inside it. */
    "Claude Design Plan/**",
    "Font unification across design system/**",
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

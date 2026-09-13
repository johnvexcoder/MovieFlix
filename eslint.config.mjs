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
    // Static legacy TV assets are plain ES5 browser scripts (one is a vendored
    // third-party lib); the Next app config is not built for them and the
    // location-assign rule recurses infinitely over them.
    "public/**",
    // Standalone test/seed scripts use node:test / tsx, not the Next app shape.
    "tests/**",
  ]),
]);

export default eslintConfig;

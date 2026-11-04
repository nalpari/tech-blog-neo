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
    // Dot Matrix 레지스트리에서 가져온 벤더 코드 (https://dotmatrix.zzzzshawn.cloud)
    "src/components/dotmatrix-loader.css",
    "src/components/ui/dotmatrix-*.{ts,tsx}",
  ]),
]);

export default eslintConfig;

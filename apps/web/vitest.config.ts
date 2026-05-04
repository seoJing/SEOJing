import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/shared/lib/test-setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "json-summary"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.d.ts",
        "src/**/*.test.ts",
        "src/**/*.spec.ts",
        "src/**/index.ts",
        "src/app/**",
        "src/generated/**",
        "src/shared/config/**",
        "src/widgets/header/header.constants.ts",
        "src/shared/lib/cn.ts",
      ],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // tsconfig.json 의 paths 에 정의된 vinext 쉼들. vitest 는 vinext 플러그인
      // 없이 동작하므로 동일한 매핑을 vite 리졸버에 직접 깔아 둔다.
      "next/font/google": path.resolve(
        __dirname,
        "./node_modules/vinext/dist/shims/font-google.js",
      ),
      "next/font/local": path.resolve(
        __dirname,
        "./node_modules/vinext/dist/shims/font-local.js",
      ),
      "next/link": path.resolve(
        __dirname,
        "./node_modules/vinext/dist/shims/link.js",
      ),
      "next/navigation": path.resolve(
        __dirname,
        "./node_modules/vinext/dist/shims/navigation.js",
      ),
    },
  },
});

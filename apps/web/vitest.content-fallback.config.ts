import { defineConfig } from "vitest/config";
import config from "./vitest.config";

export default defineConfig({
  ...config,
  test: {
    ...config.test,
    include: ["scripts/content-fallback.integration.tsx"],
  },
  resolve: {
    ...config.resolve,
    // Workspace packages currently resolve different locked React versions.
    dedupe: ["react", "react-dom"],
    alias: {
      ...config.resolve?.alias,
      "next/navigation": "vinext/shims/navigation",
      "next/link": "vinext/shims/link",
    },
  },
});

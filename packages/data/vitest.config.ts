import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@plutus/domain": new URL("../domain/src/index.ts", import.meta.url)
        .pathname,
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    globals: true,
  },
});

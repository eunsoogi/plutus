import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@plutus/test-fixtures": new URL(
        "./src/__tests__/test-fixtures-shim.ts",
        import.meta.url,
      ).pathname,
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    globals: true,
  },
});

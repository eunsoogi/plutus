import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: ["apps/web-preview/tests/**/*.spec.ts", "tests/e2e/**/*.spec.ts"],
  webServer: {
    command: "pnpm --filter @plutus/web-preview dev --host 127.0.0.1",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: true,
    timeout: 120000,
  },
  projects: [
    {
      name: "web-preview",
      use: { ...devices["Desktop Chrome"], baseURL: "http://127.0.0.1:4173" },
    },
    {
      name: "mobile-remote",
      use: { ...devices["iPhone 14"], baseURL: "http://127.0.0.1:4173" },
    },
  ],
});

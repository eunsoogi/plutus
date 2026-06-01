import { expect, test } from "@playwright/test";

test("provider settings exposes health, permission chips, and decision evidence", async ({
  page,
}) => {
  await page.goto("/settings/providers?runtime=local");

  await expect(page.getByTestId("provider-health-summary")).toContainText(
    "Connected",
  );
  await page.getByTestId("provider-binance").click();
  await expect(page.getByTestId("provider-permissions")).toContainText(
    "trade_dry_run",
  );

  await page.getByTestId("provider-mode-live").click();
  await page.getByTestId("generate-provider-decision").click();

  await expect(page.getByTestId("trading-decision-panel")).toContainText(
    "provider:binance",
  );
  await expect(page.getByTestId("trading-decision-panel")).toContainText(
    "live_requires_user_approval",
  );
});

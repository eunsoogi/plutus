import { expect, type Page } from "@playwright/test";

export async function syncUpbitHoldings(page: Page): Promise<void> {
  await page.goto("/settings/providers?runtime=local");
  await page.getByTestId("provider-select").selectOption("upbit");
  await page.getByTestId("credential-api-key-input").fill("upbit-api-key");
  await page.getByTestId("credential-secret-input").fill("upbit-secret");
  await page.getByRole("button", { name: "Save provider settings" }).click();
  await expect(page.getByTestId("provider-preview-status")).toContainText(
    "Provider settings saved locally",
  );

  await page.goto("/portfolios?runtime=local");
  await expect(page.getByTestId("portfolio-provider-sync")).toContainText(
    "Ready: Upbit",
  );
  await page.getByRole("button", { name: "Sync Upbit Holdings" }).click();
  await expect(page.getByTestId("portfolio-command-status")).toContainText(
    "Synced 2 holdings from Upbit",
  );
}

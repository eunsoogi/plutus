import { expect, test } from "@playwright/test";

test("provider settings exposes health, permission chips, and decision evidence", async ({
  page,
}) => {
  await page.goto("/settings/providers?runtime=local");

  await expect(page.getByTestId("provider-health-summary")).toContainText(
    "Not configured112",
  );
  await expect(page.getByTestId("provider-health-summary")).not.toContainText(
    "Connected3",
  );
  await page.getByTestId("provider-search").fill("binance");
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

test("provider settings fits the desktop shell and explains CCXT setup", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto("/settings/providers?runtime=local&locale=ko");

  await expect(page.getByTestId("provider-setup-guide")).toContainText(
    "API 키",
  );
  await expect(page.getByTestId("provider-setup-guide")).not.toContainText(
    "참조만",
  );
  await expect(page.getByTestId("provider-catalog-summary")).toContainText(
    "CCXT 111개",
  );

  await page.getByTestId("provider-select").selectOption("kraken");
  await expect(page.getByTestId("selected-provider-name")).toContainText(
    "크라켄",
  );

  const metrics = await page.evaluate(() => {
    const input = document.querySelector<HTMLInputElement>(
      "[data-testid='credential-api-key-input']",
    );
    const select = document.querySelector<HTMLSelectElement>(
      "[data-testid='provider-select']",
    );
    return {
      bodyOverflows:
        document.documentElement.scrollHeight > window.innerHeight + 1,
      inputHeight: input?.getBoundingClientRect().height ?? 0,
      selectHeight: select?.getBoundingClientRect().height ?? 0,
    };
  });

  expect(metrics.bodyOverflows).toBe(false);
  expect(Math.abs(metrics.inputHeight - metrics.selectHeight)).toBeLessThanOrEqual(
    1,
  );
});

test("provider settings accepts credential fields without leaving raw secrets onscreen", async ({
  page,
}) => {
  await page.goto("/settings/providers?runtime=local&locale=ko");
  await page.getByTestId("provider-select").selectOption("upbit");

  await page.getByTestId("credential-api-key-input").fill("upbit-api-key");
  await page.getByTestId("credential-secret-input").fill("upbit-secret-key");
  await page.getByTestId("credential-passphrase-input").fill("upbit-passphrase");
  await page.getByRole("button", { name: "거래 연동 저장" }).click();

  await expect(page.getByTestId("provider-preview-status")).toContainText(
    "저장",
  );
  await expect(page.getByTestId("provider-matrix")).toContainText(
    "secure://plutus/providers/upbit/main",
  );
  await expect(page.getByTestId("credential-api-key-input")).toHaveValue("");
  await expect(page.getByTestId("credential-secret-input")).toHaveValue("");
  await expect(page.getByTestId("credential-passphrase-input")).toHaveValue("");
  await expect(page.locator("body")).not.toContainText("upbit-secret-key");
});

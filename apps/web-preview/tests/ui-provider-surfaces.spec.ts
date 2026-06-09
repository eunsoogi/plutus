import { expect, test } from "@playwright/test";
test("provider settings previews dry-run and blocks live trading candidates", async ({
  page,
}) => {
  await page.goto("/dashboard?runtime=local");
  await page.getByRole("link", { name: "Trading Providers" }).click();
  await expect(page).toHaveURL(/\/settings\/providers\?runtime=local$/);
  await expect(
    page.getByRole("heading", { name: "Provider Settings" }).first(),
  ).toBeVisible();
  await page.getByTestId("provider-select").selectOption("upbit");
  await expect(page.getByTestId("selected-provider-name")).toContainText(
    "Upbit",
  );
  await page.getByTestId("provider-search").fill("binance");
  await page.getByTestId("provider-binance").click();
  await expect(page.getByText("ccxt://binance/createOrder")).toBeVisible();

  await page.getByTestId("simulate-provider-preview").click();
  await expect(page.getByTestId("provider-preview-status")).toContainText(
    "Dry-run preview accepted",
  );
  await expect(page.getByTestId("trading-decision-panel")).toContainText(
    "risk manager",
  );
  await expect(page.getByTestId("provider-payload")).toContainText(
    "ccxt://binance/createOrder",
  );

  await page.getByTestId("provider-mode-live").click();
  await expect(page.getByText("Live blocked")).toBeVisible();
  await page.getByTestId("generate-provider-decision").click();
  await expect(page.getByTestId("trading-decision-panel")).toContainText(
    "live_requires_approval",
  );
  await page.getByTestId("simulate-provider-preview").click();
  await expect(page.getByTestId("provider-preview-status")).toContainText(
    "explicit user approval",
  );
});

test("unknown host subroutes render not found without a runtime bridge", async ({
  page,
}) => {
  await page.goto("/settings/not-real");
  await expect(page.getByTestId("not-found")).toContainText(
    "The requested Plutus route does not exist.",
  );
  await expect(page.getByTestId("runtime-unavailable")).toHaveCount(0);

  await page.goto("/portfolios/portfolio-core/extra?runtime=local");
  await expect(page.getByTestId("not-found")).toContainText(
    "The requested Plutus route does not exist.",
  );

  await page.goto("/remote/runs/run-btc-nvda/extra?remote=connected");
  await expect(page.getByTestId("not-found")).toContainText(
    "The requested Plutus route does not exist.",
  );
});

test("memory, wiki, and remote-control surfaces expose MVP controls", async ({
  page,
}) => {
  await page.goto("/memory?runtime=local");
  await expect(page.getByTestId("memory-activity-feed")).toContainText(
    "No activity",
  );
  await expect(
    page.getByRole("button", { name: "Archive memory" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Archive memory" }).click();
  await expect(page.getByTestId("memory-command-status")).toContainText(
    "not available",
  );
  await expect(
    page.getByRole("button", { name: "Forget memory" }),
  ).toBeVisible();

  await page.goto("/wiki/wiki-btc-nvda-concentration?runtime=local");
  await expect(page.getByTestId("wiki-revision-timeline")).toContainText(
    "not available",
  );
  await expect(
    page.getByRole("button", { name: "Revert revision" }),
  ).toBeDisabled();
  await expect(page.getByTestId("source-link-drawer")).toContainText(
    "Source Links",
  );

  await page.goto("/settings/remote-control?runtime=local");
  await expect(page.getByTestId("pairing-code")).toContainText("Not paired");
  await expect(
    page.getByText("Pair a device before revoking access"),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Revoke/ })).toHaveCount(0);
});

test("mobile remote route exposes connected-only note and thesis mutation controls", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto("/remote/portfolios/portfolio-core?remote=connected");
  await expect(page.getByLabel("Position thesis note")).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Save thesis to Mac" }),
  ).toBeDisabled();

  await page.goto("/remote/watchlists/watchlist-default?remote=connected");
  await expect(page.getByLabel("Watchlist item note")).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Save watchlist note to Mac" }),
  ).toBeDisabled();

  await page.goto("/remote/portfolios/portfolio-core?remote=stale");
  await expect(page.getByLabel("Position thesis note")).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Save thesis to Mac" }),
  ).toBeDisabled();
});

import { expect, test } from "@playwright/test";

test("portfolio and watchlist setup starts the BTC/NVDA review and shows artifacts", async ({
  page,
}) => {
  await page.goto("/dashboard?scenario=mvp");
  await expect(
    page.getByRole("heading", { name: "Plutus Research Desk" }),
  ).toBeVisible();
  await expect(page.getByTestId("portfolio-core")).toContainText("BTC");
  await expect(page.getByTestId("portfolio-core")).toContainText("NVDA");

  await page.getByRole("link", { name: "Watchlists" }).click();
  await expect(page.getByTestId("watchlist-default")).toContainText("BTC");
  await expect(page.getByTestId("watchlist-default")).toContainText("NVDA");

  await page.getByRole("link", { name: "Runs" }).click();
  await page.getByRole("button", { name: "Start BTC/NVDA Review" }).click();
  await expect(page.getByTestId("run-progress")).toContainText(
    "Risk review complete",
  );
  await expect(page.getByTestId("risk-warning")).toContainText(
    "Past performance",
  );
  await expect(page.getByTestId("final-run-card")).toContainText(
    "risk_warning",
  );
  await expect(page.getByTestId("artifact-list")).toContainText(
    "BTC NVDA risk report",
  );
});

test("desktop run detail exposes risk warning and generated artifacts", async ({
  page,
}) => {
  await page.goto("/runs/run-btc-nvda?scenario=mvp");
  await expect(
    page.getByRole("heading", { name: "BTC/NVDA Portfolio Review" }),
  ).toBeVisible();
  await expect(page.getByTestId("risk-warning")).toBeVisible();
  await expect(page.getByTestId("artifact-chart")).toHaveAttribute(
    "data-rendered",
    "true",
  );
  await expect(
    page.getByRole("link", { name: "Open BTC NVDA risk report" }),
  ).toHaveAttribute(
    "href",
    "/runs/run-btc-nvda/artifacts/artifact-risk-report?scenario=mvp",
  );
});

test("mobile remote routes show connected, disconnected, stale, and revoked command states", async ({
  page,
  isMobile,
}) => {
  test.skip(
    !isMobile,
    "mobile remote states are asserted on the phone project",
  );

  await page.goto("/remote/dashboard?scenario=mvp&remote=connected");
  await expect(page.getByTestId("remote-state")).toContainText(
    "Connected to Plutus Mac",
  );
  await expect(
    page.getByRole("button", { name: "Start Remote BTC/NVDA Review" }),
  ).toBeEnabled();

  await page.goto("/remote/dashboard?scenario=mvp&remote=disconnected");
  await expect(page.getByTestId("remote-state")).toContainText("Disconnected");
  await expect(
    page.getByRole("button", { name: "Start Remote BTC/NVDA Review" }),
  ).toBeDisabled();

  await page.goto("/remote/dashboard?scenario=mvp&remote=stale");
  await expect(page.getByTestId("remote-state")).toContainText(
    "Stale snapshot",
  );
  await expect(
    page.getByRole("button", { name: "Start Remote BTC/NVDA Review" }),
  ).toBeDisabled();

  await page.goto("/remote/dashboard?scenario=mvp&remote=revoked");
  await expect(page.getByTestId("remote-state")).toContainText("Revoked");
  await expect(page.getByTestId("remote-command-error")).toContainText(
    "permission revoked",
  );
});

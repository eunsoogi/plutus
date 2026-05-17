import { expect, test } from "@playwright/test";

test("desktop web preview renders portfolio, risk warning, progress, artifacts, and chart", async ({
  page,
}) => {
  await page.goto("/dashboard");
  await expect(page.getByTestId("portfolio-name")).toHaveText("Core");
  await expect(page.getByTestId("risk-warning")).toContainText(
    "BTC and NVDA combined exposure",
  );
  await expect(page.getByTestId("run-progress")).toContainText("validating");
  await expect(page.getByTestId("artifact-title")).toContainText(
    "BTC/NVDA Risk Review",
  );
  const box = await page.getByTestId("risk-chart").boundingBox();
  expect(box?.width).toBeGreaterThan(100);
  expect(box?.height).toBeGreaterThan(80);
});

test("mobile remote routes show connected, disconnected, and revoked states", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/remote/dashboard");
  await expect(page.getByTestId("connection-state")).toHaveText("connected");
  await page.goto("/connection?state=disconnected");
  await expect(page.getByTestId("connection-state")).toHaveText("disconnected");
  await page.goto("/remote/dashboard?state=revoked");
  await expect(page.getByTestId("connection-state")).toHaveText("revoked");
  await expect(page.getByTestId("remote-command")).toBeDisabled();
});

const hostRoutes = [
  ["/dashboard", "Host Dashboard"],
  ["/portfolios", "Portfolios"],
  ["/portfolios/portfolio-core", "Core Portfolio"],
  ["/watchlists", "Watchlists"],
  ["/watchlists/watchlist-default", "Default Watchlist"],
  ["/instruments/instrument-btc", "BTC Instrument"],
  ["/runs", "Research Runs"],
  ["/runs/run-btc-nvda", "BTC/NVDA Portfolio Review"],
  ["/runs/run-btc-nvda/artifacts/artifact-risk-report", "BTC NVDA Risk Report"],
  ["/strategies", "Strategies"],
  ["/memory", "Memory Activity"],
  ["/wiki", "Wiki Browser"],
  ["/wiki/wiki-btc-nvda-concentration", "BTC/NVDA Concentration Lesson"],
  ["/settings/security", "Security Settings"],
  ["/settings/providers", "Provider Settings"],
  ["/settings/remote-control", "Remote Control"],
  ["/settings/import-export", "Import Export"],
] as const;

test("web preview covers every mac host route from spec 05", async ({
  page,
}) => {
  for (const [path, heading] of hostRoutes) {
    await page.goto(`${path}?scenario=mvp`);
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    await expect(page.getByTestId("route-surface")).toHaveAttribute(
      "data-route-kind",
      "host",
    );
  }
});

const mobileRoutes = [
  ["/pair", "Pair With Mac"],
  ["/connection", "Connection"],
  ["/remote/dashboard", "Remote Dashboard"],
  ["/remote/portfolios/portfolio-core", "Remote Core Portfolio"],
  ["/remote/watchlists/watchlist-default", "Remote Default Watchlist"],
  ["/remote/instruments/instrument-btc", "Remote BTC Instrument"],
  ["/remote/runs", "Remote Runs"],
  ["/remote/runs/run-btc-nvda", "Remote Run Detail"],
  ["/remote/artifacts/artifact-risk-report", "Remote Artifact"],
  ["/remote/memory", "Remote Memory"],
  ["/remote/wiki", "Remote Wiki"],
  ["/remote/wiki/wiki-btc-nvda-concentration", "Remote Wiki Page"],
  ["/remote/settings", "Remote Settings"],
] as const;

test("web preview covers every mobile remote route from spec 05", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [path, heading] of mobileRoutes) {
    await page.goto(`${path}?scenario=mvp&remote=connected`);
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    await expect(page.getByTestId("route-surface")).toHaveAttribute(
      "data-route-kind",
      "remote",
    );
  }
});

test("memory, wiki, and remote-control surfaces expose MVP controls", async ({
  page,
}) => {
  await page.goto("/memory?scenario=mvp");
  await expect(page.getByTestId("memory-activity-feed")).toContainText(
    "Captured",
  );
  await expect(
    page.getByRole("button", { name: "Archive memory" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Archive memory" }).click();
  await expect(page.getByTestId("memory-command-status")).toContainText(
    "Web preview fallback",
  );
  await expect(
    page.getByRole("button", { name: "Forget memory" }),
  ).toBeVisible();

  await page.goto("/wiki/wiki-btc-nvda-concentration?scenario=mvp");
  await expect(page.getByTestId("wiki-revision-timeline")).toContainText(
    "Revision",
  );
  await expect(
    page.getByRole("button", { name: "Revert revision" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Revert revision" }).click();
  await expect(page.getByTestId("wiki-command-status")).toContainText(
    "Web preview fallback",
  );
  await expect(page.getByTestId("source-link-drawer")).toContainText(
    "run-btc-nvda",
  );

  await page.goto("/settings/remote-control?scenario=mvp");
  await expect(page.getByTestId("pairing-code")).toContainText("418204");
  await expect(
    page.getByRole("button", { name: "Revoke Eunsoo iPhone" }),
  ).toBeVisible();
});

test("mobile remote route exposes connected-only note and thesis mutation controls", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto(
    "/remote/portfolios/portfolio-core?scenario=mvp&remote=connected",
  );
  await expect(page.getByLabel("BTC thesis note")).toBeEnabled();
  await page.getByLabel("BTC thesis note").fill("Trim only after risk review");
  await expect(
    page.getByRole("button", { name: "Save thesis to Mac" }),
  ).toBeEnabled();

  await page.goto(
    "/remote/watchlists/watchlist-default?scenario=mvp&remote=connected",
  );
  await expect(page.getByLabel("NVDA watchlist note")).toBeEnabled();
  await page.getByLabel("NVDA watchlist note").fill("Watch AI capex risk");
  await expect(
    page.getByRole("button", { name: "Save watchlist note to Mac" }),
  ).toBeEnabled();

  await page.goto(
    "/remote/portfolios/portfolio-core?scenario=mvp&remote=stale",
  );
  await expect(page.getByLabel("BTC thesis note")).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Save thesis to Mac" }),
  ).toBeDisabled();
});

test("wiki detail exposes diff and revision metadata", async ({ page }) => {
  await page.goto("/wiki/wiki-btc-nvda-concentration?scenario=mvp");
  await expect(page.getByTestId("wiki-diff-view")).toContainText(
    "stale quote warning",
  );
  await expect(page.getByTestId("wiki-revision-timeline")).toContainText(
    "audit",
  );
});

test("web preview start review falls back when no command bridge is provided", async ({
  page,
}) => {
  await page.goto("/runs?scenario=mvp");
  await page.getByRole("button", { name: "Start BTC/NVDA Review" }).click();
  await expect(page.getByTestId("run-progress")).toContainText(
    "Risk review complete",
  );
  await expect(page.getByTestId("command-source")).toHaveText(
    "Web preview fallback",
  );
});

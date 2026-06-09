import { expect, test } from "@playwright/test";
const hostRoutes = [
  ["/dashboard", "Host Dashboard"],
  ["/portfolios", "Portfolios"],
  ["/portfolios/portfolio-core", "No portfolio yet"],
  ["/watchlists", "Watchlists"],
  ["/watchlists/watchlist-default", "No watchlist yet"],
  ["/instruments/instrument-btc", "Instrument"],
  ["/runs", "Research Runs"],
  ["/runs/run-btc-nvda", "No research runs yet"],
  ["/runs/run-btc-nvda/artifacts/artifact-risk-report", "No artifact"],
  ["/strategies", "Strategies"],
  ["/memory", "Memory Activity"],
  ["/wiki", "Wiki Browser"],
  ["/wiki/wiki-btc-nvda-concentration", "Wiki Page"],
  ["/settings/security", "Security Settings"],
  ["/settings/providers", "Provider Settings"],
  ["/settings/preferences", "Preferences"],
  ["/settings/remote-control", "Remote Control"],
  ["/settings/import-export", "Import Export"],
] as const;

test("web preview covers every mac host route from spec 05", async ({
  page,
}) => {
  for (const [path, heading] of hostRoutes) {
    await page.goto(`${path}?runtime=local`);
    await expect(
      page.getByRole("heading", { name: heading }).first(),
    ).toBeVisible();
    await expect(page.getByTestId("route-surface")).toHaveAttribute(
      "data-route-kind",
      "host",
    );
  }
});

test("sidebar navigation updates host routes without reloading the document", async ({
  page,
}) => {
  await page.goto("/dashboard?runtime=local");
  await page.evaluate(() => {
    Reflect.set(window, "__plutusNavigationMarker", "kept");
  });

  await page.getByRole("link", { name: "Providers" }).click();

  await expect(page).toHaveURL(/\/settings\/providers\?runtime=local$/u);
  await expect(
    page.getByRole("heading", { name: "Provider Settings" }),
  ).toBeVisible();
  await expect(
    page.evaluate(() => Reflect.get(window, "__plutusNavigationMarker")),
  ).resolves.toBe("kept");
});

test("packaged hash mode keeps sidebar host routes on the root bundle", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Reflect.set(window, "__PLUTUS_ROUTE_MODE__", "hash");
  });
  await page.goto("/dashboard?runtime=local");
  await page.evaluate(() => {
    Reflect.set(window, "__plutusNavigationMarker", "kept");
  });

  await page.getByRole("link", { name: "Providers" }).click();

  await expect(page).toHaveURL(/\/#\/settings\/providers\?runtime=local$/u);
  await expect(
    page.getByRole("heading", { name: "Provider Settings" }),
  ).toBeVisible();
  await expect(
    page.evaluate(() => Reflect.get(window, "__plutusNavigationMarker")),
  ).resolves.toBe("kept");
});

test("packaged startup renders a route shell while the initial snapshot is pending", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Reflect.set(window, "__PLUTUS_ROUTE_MODE__", "hash");
    Reflect.set(window, "__PLUTUS_COMMAND_BRIDGE__", async () => {
      await new Promise(() => {});
    });
  });

  await page.goto("/dashboard");

  await expect(
    page.getByRole("heading", { name: "Host Dashboard" }),
  ).toBeVisible();
  await expect(page.getByTestId("route-surface")).toHaveAttribute(
    "data-route-kind",
    "host",
  );
});

test("packaged hash mode updates locale inside mobile hash routes", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Reflect.set(window, "__PLUTUS_ROUTE_MODE__", "hash");
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#/remote/dashboard?remote=connected&locale=ko");

  const localeSelect = page.locator(".locale-switcher select");
  await expect(localeSelect).toHaveValue("ko");

  await localeSelect.selectOption("en");

  await expect(localeSelect).toHaveValue("en");
  await expect(page).toHaveURL(
    /\/#\/remote\/dashboard\?remote=connected&locale=en$/u,
  );

  await page.getByRole("link", { name: "Settings" }).click();

  await expect(page).toHaveURL(
    /\/#\/remote\/settings\?remote=connected&locale=en$/u,
  );

  await page.reload();

  await expect(page.locator(".locale-switcher select")).toHaveValue("en");
});

const mobileRoutes = [
  ["/pair", "Pair With Mac"],
  ["/connection", "Connection"],
  ["/remote/dashboard", "Remote Dashboard"],
  ["/remote/portfolios/portfolio-core", "Remote Portfolio"],
  ["/remote/watchlists/watchlist-default", "Remote Watchlist"],
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
    await page.goto(`${path}?remote=connected`);
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    await expect(page.getByTestId("route-surface")).toHaveAttribute(
      "data-route-kind",
      "remote",
    );
  }
});

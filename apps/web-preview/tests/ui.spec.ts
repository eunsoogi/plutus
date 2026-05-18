import { expect, test } from "@playwright/test";

test("browser runtime does not render seeded portfolio data without a command bridge", async ({
  page,
}) => {
  await page.goto("/dashboard");
  await expect(page.getByTestId("runtime-unavailable")).toContainText(
    "No local Plutus runtime bridge is connected",
  );
  await expect(page.getByText("BTC/NVDA Risk Review")).toHaveCount(0);
  await expect(page.getByText("Core Portfolio")).toHaveCount(0);
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
    "Revision:",
  );
  await expect(
    page.getByRole("button", { name: "Revert revision" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Revert revision" }).click();
  await expect(page.getByTestId("wiki-command-status")).toContainText(
    "not available",
  );
  await expect(page.getByTestId("source-link-drawer")).toContainText(
    "Source Links",
  );

  await page.goto("/settings/remote-control?runtime=local");
  await expect(page.getByTestId("pairing-code")).toContainText("Not paired");
  await expect(
    page.getByRole("button", { name: "Revoke No paired device" }),
  ).toBeVisible();
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

test("command-backed remote editors preserve and save notes", async ({
  page,
}) => {
  const callsKey = `plutusRemoteEditCalls-${Date.now()}`;
  await page.addInitScript((key) => {
    window.__PLUTUS_COMMAND_BRIDGE__ = (async (envelope) => {
      const calls = JSON.parse(localStorage.getItem(key) ?? "[]");
      calls.push(envelope);
      localStorage.setItem(key, JSON.stringify(calls));
      if (envelope.command === "app.getSnapshot") {
        return {
          profileId: "profile-real",
          portfolios: [
            {
              id: "portfolio-real",
              name: "Real Portfolio",
              baseCurrency: "USD",
              positions: [
                {
                  id: "position-real",
                  symbol: "AAPL",
                  name: "Apple Inc.",
                  quantity: 2,
                  averageCost: 175,
                  thesis: "Existing thesis",
                },
              ],
            },
          ],
          watchlists: [
            {
              id: "watchlist-real",
              name: "Real Watchlist",
              items: [
                {
                  id: "watch-real",
                  symbol: "MSFT",
                  triggerNote: "Existing note",
                },
              ],
            },
          ],
          runs: [],
          artifacts: [],
          memoryActivity: [],
          wikiPages: [],
          remoteDevices: [
            {
              name: "Test iPhone",
            },
          ],
        };
      }
      if (envelope.command === "remote.prepareUnlock") {
        return {
          sessionId: "session-real",
          sessionKeyRef: "secure://session-real",
          unlockProof: {
            method: "biometric",
            sessionKeyRef: "secure://session-real",
            challenge: "ed25519:test",
          },
        };
      }
      if (envelope.command === "remote.executeCommand") {
        return {
          authorization: {
            success: true,
            permissionGranted: true,
            warnings: [],
          },
          data: { ok: true },
        };
      }
      throw new Error(`Unexpected command ${envelope.command}`);
    }) as NonNullable<Window["__PLUTUS_COMMAND_BRIDGE__"]>;
  }, callsKey);

  await page.goto("/remote/portfolios/portfolio-real?remote=connected");
  await expect(page.getByLabel("AAPL thesis note")).toHaveValue(
    "Existing thesis",
  );
  await page.getByRole("button", { name: "Save thesis to Mac" }).click();
  await expect(page.getByTestId("remote-edit-status")).toContainText(
    "Saved thesis to Mac",
  );

  await page.goto("/remote/watchlists/watchlist-real?remote=connected");
  await expect(page.getByLabel("MSFT watchlist note")).toHaveValue(
    "Existing note",
  );
  await page
    .getByRole("button", { name: "Save watchlist note to Mac" })
    .click();
  await expect(page.getByTestId("remote-watchlist-status")).toContainText(
    "Saved watchlist note to Mac",
  );

  const calls = await page.evaluate((key) => {
    return JSON.parse(localStorage.getItem(key) ?? "[]") as Array<{
      command: string;
      args: unknown[];
    }>;
  }, callsKey);
  expect(calls).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        command: "remote.prepareUnlock",
        args: [
          expect.objectContaining({
            commandType: "portfolio.updatePositionThesis",
            payload: expect.objectContaining({
              positionId: "position-real",
            }),
          }),
        ],
      }),
      expect.objectContaining({
        command: "remote.executeCommand",
        args: [
          expect.objectContaining({
            commandType: "portfolio.updatePositionThesis",
          }),
        ],
      }),
      expect.objectContaining({
        command: "remote.prepareUnlock",
        args: [
          expect.objectContaining({
            commandType: "watchlist.updateItem",
            payload: expect.objectContaining({
              itemId: "watch-real",
            }),
          }),
        ],
      }),
      expect.objectContaining({
        command: "remote.executeCommand",
        args: [
          expect.objectContaining({
            commandType: "watchlist.updateItem",
          }),
        ],
      }),
    ]),
  );
});

test("command-backed remote editors do not fall back to the first entity for bad route ids", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.__PLUTUS_COMMAND_BRIDGE__ = (async (envelope) => {
      if (envelope.command === "app.getSnapshot") {
        return {
          profileId: "profile-real",
          portfolios: [
            {
              id: "portfolio-real",
              name: "Real Portfolio",
              positions: [
                {
                  id: "position-real",
                  symbol: "AAPL",
                  quantity: 2,
                  averageCost: 175,
                  thesis: "Existing thesis",
                },
              ],
            },
          ],
          watchlists: [
            {
              id: "watchlist-real",
              name: "Real Watchlist",
              items: [
                {
                  id: "watch-real",
                  symbol: "MSFT",
                  triggerNote: "Existing note",
                },
              ],
            },
          ],
          runs: [],
          artifacts: [],
          memoryActivity: [],
          wikiPages: [],
          remoteDevices: [],
        };
      }
      throw new Error(`Unexpected command ${envelope.command}`);
    }) as NonNullable<Window["__PLUTUS_COMMAND_BRIDGE__"]>;
  });

  await page.goto("/remote/portfolios/not-real?remote=connected");
  await expect(page.getByLabel("Position thesis note")).toBeDisabled();
  await expect(page.getByLabel("AAPL thesis note")).toHaveCount(0);

  await page.goto("/remote/watchlists/not-real?remote=connected");
  await expect(page.getByLabel("Watchlist item note")).toBeDisabled();
  await expect(page.getByLabel("MSFT watchlist note")).toHaveCount(0);
});

test("wiki detail exposes diff and revision metadata", async ({ page }) => {
  await page.goto("/wiki/wiki-btc-nvda-concentration?runtime=local");
  await expect(page.getByTestId("wiki-diff-view")).toContainText(
    "stale quote warning",
  );
  await expect(page.getByTestId("wiki-revision-timeline")).toContainText(
    "audit",
  );
});

test("browser local runtime queues a research run only after real portfolio state exists", async ({
  page,
}) => {
  await page.goto("/runs?runtime=local");
  await page.evaluate(() => localStorage.removeItem("plutus.localRuntime.v1"));
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Start Research Run" }),
  ).toBeDisabled();
  await expect(page.getByTestId("final-run-card")).toContainText("none");

  await page.goto("/portfolios?runtime=local");
  await page.getByRole("button", { name: "Create Portfolio" }).click();
  await expect(page.getByTestId("portfolio-command-status")).toContainText(
    "Created Primary Portfolio",
  );
  await page.goto("/runs?runtime=local");
  await expect(
    page.getByRole("button", { name: "Start Research Run" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Start Research Run" }).click();
  await expect(page.getByTestId("run-progress")).toContainText("queued");
});

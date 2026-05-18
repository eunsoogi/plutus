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

test("locale query renders Korean chrome and persists language changes", async ({
  page,
}) => {
  await page.goto("/dashboard?runtime=local&locale=ko");
  await expect(page.getByRole("link", { name: "포트폴리오" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "호스트 대시보드" }),
  ).toBeVisible();
  await expect(page.getByLabel("언어")).toHaveValue("ko");

  await page.getByLabel("언어").selectOption("en");
  await expect(page).toHaveURL(/locale=en/);
  await expect(page.getByRole("link", { name: "Portfolios" })).toBeVisible();

  await page.goto("/remote/dashboard?remote=connected&locale=ko");
  await expect(page.getByLabel("언어")).toHaveValue("ko");
  await expect(page.getByTestId("remote-state")).toContainText(
    "Plutus Mac에 연결됨",
  );
});

test("Korean locale covers host and remote UI chrome without English leftovers", async ({
  page,
}) => {
  const koreanRoutes = [
    "/dashboard?runtime=local&locale=ko",
    "/portfolios?runtime=local&locale=ko",
    "/watchlists/watchlist-default?runtime=local&locale=ko",
    "/runs?runtime=local&locale=ko",
    "/memory?runtime=local&locale=ko",
    "/wiki/wiki-btc-nvda-concentration?runtime=local&locale=ko",
    "/settings/remote-control?runtime=local&locale=ko",
    "/remote/dashboard?remote=connected&locale=ko",
    "/remote/portfolios/portfolio-core?remote=connected&locale=ko",
    "/remote/watchlists/watchlist-default?remote=connected&locale=ko",
    "/remote/runs/run-btc-nvda?remote=connected&locale=ko",
    "/remote/settings?remote=connected&locale=ko",
  ] as const;
  const untranslatedChrome = [
    "Current guardrail",
    "Run Progress",
    "Artifacts",
    "No artifacts yet",
    "No portfolio yet",
    "No watchlist yet",
    "No research runs yet",
    "No memory captured yet",
    "No wiki pages captured yet",
    "Create Portfolio",
    "Position Thesis Notes",
    "Watchlist Notes",
    "Editable Notes",
    "Memory Activity",
    "Activity Feed",
    "Category Toggles",
    "Archive memory",
    "Forget memory",
    "Wiki Browser",
    "Wiki Page",
    "Revision Timeline",
    "Source Links",
    "Diff View",
    "Not Found",
    "Remote Control",
    "Status",
    "Enabled",
    "Pairing code",
    "Connected device",
    "Pair With Mac",
    "Connection",
    "Remote Portfolio",
    "Remote Thesis Edit",
    "Save thesis to Mac",
    "Remote Watchlist",
    "Remote Note Edit",
    "Save watchlist note to Mac",
    "Remote Run Detail",
    "Cancel Mac-hosted run",
    "Remote Settings",
    "Read-only",
    "Biometric unlock required",
  ];

  for (const route of koreanRoutes) {
    await page.goto(route);
    const visibleText = await page.locator("body").innerText();
    for (const englishText of untranslatedChrome) {
      expect(
        visibleText,
        `${route} still contains ${englishText}`,
      ).not.toContain(englishText);
    }
  }

  await page.goto("/dashboard?runtime=local&locale=ko");
  await expect(
    page.getByRole("heading", { name: "아직 포트폴리오 없음" }),
  ).toBeVisible();
  await expect(page.getByText("아직 포트폴리오 없음 포트폴리오")).toHaveCount(
    0,
  );

  await page.goto("/settings/remote-control?runtime=local&locale=ko");
  await expect(page.getByText("페어링 안 됨").first()).toBeVisible();
  await expect(
    page.getByText("기기를 페어링한 뒤 연결을 해제할 수 있습니다"),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /연결 해제/ })).toHaveCount(0);
});

test("mobile remote routes show connected, disconnected, and revoked states", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/remote/dashboard");
  await expect(page.getByTestId("connection-state")).toHaveText(
    "Connected to Plutus Mac",
  );
  await page.goto("/connection?state=disconnected");
  await expect(page.getByTestId("connection-state")).toHaveText("Disconnected");
  await page.goto("/remote/dashboard?state=revoked");
  await expect(page.getByTestId("connection-state")).toHaveText("Revoked");
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

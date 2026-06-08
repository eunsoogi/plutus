import { expect, test, type Page } from "@playwright/test";

async function syncUpbitHoldings(page: Page): Promise<void> {
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
    "/settings/providers?runtime=local&locale=ko",
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
    "Provider Settings",
    "Read-only",
    "Biometric unlock required",
    "MVP",
    "Portfolio review",
    "Awaiting local data",
    "Local data loaded",
    "Primary Portfolio",
    "Agent activity",
    "Workspace status",
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

  await page.goto("/dashboard?runtime=local&locale=ko");
  await expect(page.getByRole("link", { name: "거래 연동" })).toBeVisible();
  await expect(page.getByText("거래 Provider")).toHaveCount(0);
  await page.getByRole("link", { name: "거래 연동" }).click();
  await expect(
    page.getByRole("heading", { name: "거래 연동 설정" }).first(),
  ).toBeVisible();
  await expect(page.getByTestId("provider-kiwoom")).toContainText("키움증권");
  await page.getByTestId("provider-search").fill("업비트");
  await expect(page.getByTestId("provider-upbit")).toContainText("업비트");
  await page.getByTestId("provider-search").fill("코인베이스");
  await expect(page.getByTestId("provider-coinbase")).toContainText(
    "코인베이스",
  );
  await page.getByTestId("provider-search").fill("바이낸스");
  await expect(page.getByTestId("provider-binance")).toContainText("바이낸스");
  await page.getByTestId("provider-search").fill("");
  await expect(page.getByTestId("provider-health-summary")).toContainText(
    "설정 안 됨112",
  );
  await expect(page.getByTestId("provider-health-summary")).not.toContainText(
    "연결됨3",
  );
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

test("wiki detail exposes diff and revision metadata for real wiki state", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.__PLUTUS_COMMAND_BRIDGE__ = (async (envelope) => {
      if (envelope.command === "app.getSnapshot") {
        return {
          profileId: "profile-wiki",
          portfolios: [],
          watchlists: [],
          runs: [],
          artifacts: [],
          memoryActivity: [],
          wikiPages: [
            {
              id: "wiki-btc-nvda-concentration",
              title: "Wiki Page",
              currentRevisionId: "audit-wiki-btc-nvda-revision",
              diffBody: "Added concentration lesson and stale quote warning.",
              sourceRefs: [{ type: "run", id: "run-btc-nvda" }],
            },
          ],
          remoteDevices: [],
        };
      }
      throw new Error(`Unexpected command ${envelope.command}`);
    }) as NonNullable<Window["__PLUTUS_COMMAND_BRIDGE__"]>;
  });
  await page.goto("/wiki/wiki-btc-nvda-concentration?runtime=local");
  await expect(page.getByTestId("wiki-diff-view")).toContainText(
    "stale quote warning",
  );
  await expect(page.getByTestId("wiki-revision-timeline")).toContainText(
    "audit",
  );
});

test("wiki detail uses the routed wiki page when multiple pages exist", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.__PLUTUS_COMMAND_BRIDGE__ = (async (envelope) => {
      if (envelope.command === "app.getSnapshot") {
        return {
          profileId: "profile-wiki",
          portfolios: [],
          watchlists: [],
          runs: [],
          artifacts: [],
          memoryActivity: [],
          wikiPages: [
            {
              id: "wiki-first",
              title: "First Wiki",
              currentRevisionId: "revision-first",
              revisionNote: "First page revision note.",
              sourceRefs: [],
            },
            {
              id: "wiki-target",
              title: "Target Wiki",
              currentRevisionId: "revision-target",
              revisionNote: "Target page revision note.",
              sourceRefs: [],
            },
          ],
          remoteDevices: [],
        };
      }
      throw new Error(`Unexpected command ${envelope.command}`);
    }) as NonNullable<Window["__PLUTUS_COMMAND_BRIDGE__"]>;
  });
  await page.goto("/wiki/wiki-target");

  await expect(
    page.getByRole("heading", { name: "Target Wiki", level: 1 }),
  ).toBeVisible();
  await expect(page.getByTestId("wiki-diff-view")).toContainText(
    "Target page revision note.",
  );
  await expect(page.getByText("First page revision note.")).toHaveCount(0);
});

test("ready run placeholder with only an id does not render started progress", async ({
  page,
}) => {
  // Given: the runtime has reserved a run id but has not started real work.
  await page.addInitScript(() => {
    window.__PLUTUS_COMMAND_BRIDGE__ = (async (envelope) => {
      if (envelope.command === "app.getSnapshot") {
        return {
          profileId: "profile-placeholder",
          portfolios: [
            {
              id: "portfolio-placeholder",
              name: "Placeholder Portfolio",
              baseCurrency: "USD",
              positions: [],
            },
          ],
          watchlists: [],
          runs: [
            {
              id: "run-placeholder",
              portfolioId: "portfolio-placeholder",
              status: "ready",
              title: "Pending placeholder",
              category: "",
            },
          ],
          artifacts: [],
          memoryActivity: [],
          wikiPages: [],
          remoteDevices: [],
        };
      }
      throw new Error(`Unexpected command ${envelope.command}`);
    }) as NonNullable<Window["__PLUTUS_COMMAND_BRIDGE__"]>;
  });

  // When: the Runs page renders the placeholder snapshot.
  await page.goto("/runs?runtime=local");

  // Then: the unstarted stage list remains visible instead of run status chrome.
  await expect(page.getByTestId("run-progress")).toContainText("planning");
  await expect(page.getByTestId("run-progress")).not.toContainText("ready");
  await expect(page.getByTestId("command-source")).toHaveCount(0);
});

test("command bridge run source persists after returning to Runs", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const runStartedKey = "plutus.commandBridgeRunStarted";
    window.__PLUTUS_COMMAND_BRIDGE__ = (async (envelope) => {
      const runStarted = localStorage.getItem(runStartedKey) === "1";
      if (envelope.command === "app.getSnapshot") {
        return {
          profileId: "profile-bridge",
          portfolios: [
            {
              id: "portfolio-bridge",
              name: "Bridge Portfolio",
              baseCurrency: "USD",
              positions: [
                {
                  id: "position-bridge",
                  symbol: "AAPL",
                  name: "Apple Inc.",
                  quantity: 1,
                  averageCost: 100,
                  thesis: "Bridge position",
                },
              ],
            },
          ],
          watchlists: [],
          runs: [
            {
              id: "run-bridge",
              portfolioId: "portfolio-bridge",
              status: runStarted ? "completed" : "ready",
              title: "Bridge run",
              category: runStarted ? "portfolio_review" : "",
              finalCard: runStarted
                ? {
                    selectedTeam: "portfolio_review_committee",
                    summary: "Bridge run complete",
                  }
                : undefined,
            },
          ],
          artifacts: [],
          memoryActivity: [],
          wikiPages: [],
          remoteDevices: [],
        };
      }
      if (envelope.command === "researchRuns.start") {
        localStorage.setItem(runStartedKey, "1");
        return {
          id: "run-bridge",
          portfolioId: "portfolio-bridge",
          status: "queued",
        };
      }
      throw new Error(`Unexpected command ${envelope.command}`);
    }) as NonNullable<Window["__PLUTUS_COMMAND_BRIDGE__"]>;
  });

  await page.goto("/runs?runtime=local");
  await page.getByRole("button", { name: "Start Research Run" }).click();
  await expect(page.getByTestId("command-source")).toHaveText("Command bridge");

  await page.goto("/dashboard?runtime=local");
  await page.goto("/runs?runtime=local");

  await expect(page.getByTestId("run-progress")).toContainText("completed");
  await expect(page.getByTestId("command-source")).toHaveText("Command bridge");
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
  await expect(page.getByTestId("orchestrator-office")).toHaveCount(0);
  await expect(page.getByText(/BTC|NVDA/)).toHaveCount(0);

  await syncUpbitHoldings(page);
  await page.goto("/runs?runtime=local");
  await expect(
    page.getByRole("button", { name: "Start Research Run" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Start Research Run" }).click();
  await expect(page.getByTestId("run-progress")).toContainText("queued");
});

test("dashboard renders the orchestrator office before a research run starts", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.removeItem("plutus.localRuntime.v1");
  });

  await page.goto("/dashboard?runtime=local");

  await expect(page.getByTestId("run-progress")).toContainText("planning");
  await expect(page.getByTestId("orchestrator-office")).toBeVisible();
  await expect(page.getByTestId("orchestrator-office-scene")).toBeVisible();
});

test("browser local runtime restores queued run state after returning to Runs", async ({
  page,
}) => {
  // Given: a persisted local-browser research run exists.
  await page.goto("/runs?runtime=local");
  await page.evaluate(() => localStorage.removeItem("plutus.localRuntime.v1"));
  await syncUpbitHoldings(page);
  await page.goto("/runs?runtime=local");
  await page.getByRole("button", { name: "Start Research Run" }).click();
  await expect(page.getByTestId("run-progress")).toContainText("queued");

  // When: the Runs page remounts after route navigation.
  await page.goto("/dashboard?runtime=local");
  await page.goto("/runs?runtime=local");

  // Then: the visible run state comes from the latest scenario snapshot.
  await expect(page.getByTestId("run-progress")).toContainText("queued");
  await expect(page.getByTestId("command-source")).toHaveText("Local runtime");
});

test("portfolio screen syncs provider holdings before starting a research run", async ({
  page,
}) => {
  const callsKey = `plutusPortfolioPositionCalls-${Date.now()}`;
  await page.addInitScript((key) => {
    type BridgeEnvelope = { command: string; args: unknown[] };
    type LocalPosition = {
      id: string;
      symbol: string;
      name: string;
      quantity: number;
      averageCost: number;
      costCurrency: string;
      thesis: string;
    };
    type LocalPortfolio = {
      id: string;
      name: string;
      baseCurrency: string;
      positions: LocalPosition[];
    };
    type BridgeState = {
      profileId: string;
      portfolios: LocalPortfolio[];
      runs: Array<{
        id: string;
        portfolioId: string;
        status: string;
        title: string;
        category: string;
      }>;
    };
    const stateKey = `${key}:state`;
    function readState(): BridgeState {
      const stored = localStorage.getItem(stateKey);
      if (stored) return JSON.parse(stored) as BridgeState;
      return {
        profileId: "profile-real",
        portfolios: [],
        runs: [],
      };
    }
    function writeState(state: BridgeState) {
      localStorage.setItem(stateKey, JSON.stringify(state));
    }
    const configuredProvider = {
      providerId: "upbit",
      displayName: "Upbit",
      market: "crypto",
      region: "KR",
      environment: "sandbox",
      mode: "read_only",
      permissions: ["market_data", "account_read"],
      health: "connected",
      lastCheckedAt: "2026-06-08T00:00:00.000Z",
      credentialRef: "secure://plutus/providers/upbit/main",
      warnings: [],
    };
    window.__PLUTUS_COMMAND_BRIDGE__ = (async (envelope) => {
      const calls = JSON.parse(
        localStorage.getItem(key) ?? "[]",
      ) as BridgeEnvelope[];
      calls.push(envelope);
      localStorage.setItem(key, JSON.stringify(calls));

      const state = readState();
      if (envelope.command === "app.getSnapshot") {
        return {
          profileId: state.profileId,
          portfolios: state.portfolios,
          watchlists: [],
          runs: state.runs,
          artifacts: [],
          memoryActivity: [],
          wikiPages: [],
          remoteDevices: [],
          tradingProviders: [configuredProvider],
        };
      }
      if (envelope.command === "providers.list") {
        return [configuredProvider];
      }
      if (envelope.command === "portfolios.syncFromProvider") {
        const [input] = envelope.args as [
          {
            baseCurrency?: string;
            portfolioName?: string;
            providerId: string;
          },
        ];
        const portfolio = {
          id: "portfolio-synced",
          name: input.portfolioName ?? "Upbit Synced Holdings",
          baseCurrency: input.baseCurrency ?? "KRW",
          positions: [
            {
              id: "position-btc",
              symbol: "BTC-KRW",
              name: "Bitcoin",
              quantity: 0.42,
              averageCost: 91000000,
              costCurrency: "KRW",
              thesis: "Imported from Upbit account balance.",
            },
            {
              id: "position-eth",
              symbol: "ETH-KRW",
              name: "Ethereum",
              quantity: 2.5,
              averageCost: 4800000,
              costCurrency: "KRW",
              thesis: "",
            },
          ],
        };
        state.portfolios = [portfolio];
        writeState(state);
        return {
          importedCount: 2,
          portfolioId: portfolio.id,
          providerId: input.providerId,
          skippedCount: 0,
          positionSymbols: ["BTC-KRW", "ETH-KRW"],
        };
      }
      if (envelope.command === "researchRuns.start") {
        const [input] = envelope.args as [
          { portfolioId?: string; symbols?: string[]; userRequest?: string },
        ];
        const run = {
          id: "run-added-symbol",
          portfolioId: input.portfolioId ?? "",
          status: "queued",
          title: input.userRequest ?? "Portfolio review",
          category: "",
        };
        state.runs = [run];
        writeState(state);
        return run;
      }
      throw new Error(`Unexpected command ${envelope.command}`);
    }) as NonNullable<Window["__PLUTUS_COMMAND_BRIDGE__"]>;
  }, callsKey);

  await page.goto("/portfolios?runtime=local");
  await expect(page.getByTestId("portfolio-provider-sync")).toContainText(
    "Ready: Upbit",
  );
  await page.getByRole("button", { name: "Sync Upbit Holdings" }).click();
  await expect(page.getByTestId("portfolio-command-status")).toContainText(
    "Synced 2 holdings from Upbit",
  );
  await expect(page.getByTestId("portfolio-core")).toContainText("BTC-KRW");
  await expect(page.getByTestId("portfolio-core")).toContainText("ETH-KRW");

  await page.goto("/runs?runtime=local");
  await page.getByRole("button", { name: "Start Research Run" }).click();
  await expect(page.getByTestId("run-progress")).toContainText("queued");

  const calls = await page.evaluate((key) => {
    return JSON.parse(localStorage.getItem(key) ?? "[]") as Array<{
      command: string;
      args: unknown[];
    }>;
  }, callsKey);
  expect(calls).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        command: "portfolios.syncFromProvider",
        args: [
          expect.objectContaining({
            providerId: "upbit",
            baseCurrency: "KRW",
          }),
        ],
      }),
      expect.objectContaining({
        command: "researchRuns.start",
        args: [
          expect.objectContaining({
            portfolioId: "portfolio-synced",
            symbols: ["BTC-KRW", "ETH-KRW"],
          }),
        ],
      }),
    ]),
  );
});

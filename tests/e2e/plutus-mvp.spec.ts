import { expect, test } from "@playwright/test";

declare global {
  interface Window {
    __PLUTUS_COMMAND_BRIDGE__?: (envelope: {
      command: string;
      args: unknown[];
    }) => Promise<unknown>;
  }
}

const configuredKoreanUpbitProvider = {
  providerId: "upbit",
  displayName: "업비트",
  market: "crypto",
  region: "KR",
  environment: "sandbox",
  mode: "read_only",
  permissions: ["market_data", "account_read"],
  health: "connected",
  lastCheckedAt: "2026-06-08T00:00:00.000Z",
  credentialRef: "secure://plutus/providers/upbit/main",
  warnings: [],
} as const;

test("browser runtime starts empty instead of seeded with BTC/NVDA data", async ({
  page,
}) => {
  await page.goto("/dashboard?runtime=local");
  await expect(
    page.getByRole("heading", { name: "Plutus Research Desk" }),
  ).toBeVisible();
  await expect(page.getByTestId("portfolio-core")).toContainText(
    "No portfolio yet",
  );
  await expect(page.getByText("BTC/NVDA")).toHaveCount(0);
  await expect(page.getByText("Agent Activity")).toHaveCount(0);
  await expect(page.getByText("NVDA earnings context")).toHaveCount(0);
  await expect(page.getByText("BTC liquidity sweep")).toHaveCount(0);
  await expect(page.getByText("MVP")).toHaveCount(0);
  await expect(page.getByText("Primary Portfolio")).toHaveCount(0);
  await expect(page.getByText("Awaiting local data")).toBeVisible();
  await expect(page.getByText("Local data loaded")).toHaveCount(0);

  await page.getByRole("link", { name: "Watchlists" }).click();
  await expect(page.getByTestId("watchlist-default")).toContainText(
    "No watchlist yet",
  );

  await page.getByRole("link", { name: "Runs" }).click();
  await expect(
    page.getByRole("button", { name: "Start Research Run" }),
  ).toBeDisabled();
  await expect(page.getByTestId("final-run-card")).toContainText("none");
});

test("Korean portfolio sync avoids internal milestone and English default labels", async ({
  page,
}) => {
  await page.addInitScript((provider) => {
    localStorage.setItem(
      "plutus.localRuntime.v1",
      JSON.stringify({
        profileId: "profile-ko",
        portfolios: [],
        watchlists: [],
        runs: [],
        artifacts: [],
        memoryActivity: [],
        wikiPages: [],
        remoteDevices: [],
        tradingProviders: [provider],
        tradingDecisions: [],
        dryRunOrders: [],
      }),
    );
  }, configuredKoreanUpbitProvider);

  await page.goto("/portfolios?runtime=local&locale=ko");
  await expect(page.getByTestId("portfolio-provider-sync")).toContainText(
    "준비됨: 업비트",
  );
  await page.getByRole("button", { name: "업비트 보유 종목 동기화" }).click();
  await expect(page.getByTestId("portfolio-command-status")).toContainText(
    "업비트에서 2개 보유 종목 동기화됨",
  );
  await expect(page.getByTestId("portfolio-core")).toContainText("BTC-KRW");
  await expect(page.getByTestId("portfolio-core")).toContainText("ETH-KRW");
  await expect(page.getByText("Primary Portfolio")).toHaveCount(0);
  await expect(page.getByText("MVP")).toHaveCount(0);
});

test("legacy local preview portfolio names are localized before rendering", async ({
  page,
}) => {
  await page.goto("/dashboard?runtime=local&locale=ko");
  await page.evaluate(() => {
    localStorage.setItem(
      "plutus.localRuntime.v1",
      JSON.stringify({
        profileId: "local-browser-profile",
        portfolios: [
          {
            id: "portfolio-legacy",
            name: "Core Portfolio",
            baseCurrency: "USD",
            positions: [],
          },
        ],
        watchlists: [],
        runs: [],
        artifacts: [],
        memoryActivity: [],
        wikiPages: [],
        remoteDevices: [],
      }),
    );
  });
  await page.reload();

  await expect(page.getByTestId("portfolio-core")).toContainText(
    "기본 포트폴리오",
  );
  await expect(page.getByText("Core Portfolio")).toHaveCount(0);
  await expect(page.getByText("Primary Portfolio")).toHaveCount(0);
  await expect(page.getByText("기본 포트폴리오 포트폴리오")).toHaveCount(0);
});

test("Korean portfolio sync status localizes command bridge provider names", async ({
  page,
}) => {
  await page.addInitScript((provider) => {
    let synced = false;
    window.__PLUTUS_COMMAND_BRIDGE__ = async (envelope) => {
      if (envelope.command === "app.getSnapshot") {
        return {
          profileId: "profile-ko",
          portfolios: synced
            ? [
                {
                  id: "portfolio-synced",
                  name: "Primary Portfolio",
                  baseCurrency: "KRW",
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
                  ],
                },
              ]
            : [],
          watchlists: [],
          runs: [],
          artifacts: [],
          memoryActivity: [],
          wikiPages: [],
          remoteDevices: [],
        };
      }
      if (envelope.command === "providers.list") {
        return [provider];
      }
      if (envelope.command === "portfolios.syncFromProvider") {
        synced = true;
        return {
          importedCount: 1,
          portfolioId: "portfolio-synced",
          providerId: "upbit",
          skippedCount: 0,
          positionSymbols: ["BTC-KRW"],
        };
      }
      throw new Error(`Unexpected command ${envelope.command}`);
    };
  }, configuredKoreanUpbitProvider);
  await page.goto("/portfolios?locale=ko");
  await expect(page.getByTestId("portfolio-provider-sync")).toContainText(
    "준비됨: 업비트",
  );
  await page.getByRole("button", { name: "업비트 보유 종목 동기화" }).click();

  await expect(page.getByTestId("portfolio-command-status")).toContainText(
    "업비트에서 1개 보유 종목 동기화됨",
  );
  await expect(page.getByText("Primary Portfolio")).toHaveCount(0);
  await expect(page.getByTestId("portfolio-core")).toContainText(
    "기본 포트폴리오",
  );
  await expect(page.getByTestId("portfolio-core")).toContainText("BTC-KRW");
  await expect(page.getByText("Upbit Synced Holdings")).toHaveCount(0);
});

test("dashboard data status reflects loaded local state", async ({ page }) => {
  await page.addInitScript(() => {
    window.__PLUTUS_COMMAND_BRIDGE__ = async (envelope) => {
      if (envelope.command === "app.getSnapshot") {
        return {
          profileId: "profile-real",
          portfolios: [
            {
              id: "portfolio-real",
              name: "Real Portfolio",
              baseCurrency: "USD",
              positions: [],
            },
          ],
          watchlists: [],
          runs: [],
          artifacts: [],
          memoryActivity: [],
          wikiPages: [],
          remoteDevices: [],
        };
      }
      throw new Error(`Unexpected command ${envelope.command}`);
    };
  });

  await page.goto("/dashboard?locale=ko");
  await expect(page.getByText("로컬 데이터 로드됨")).toBeVisible();
  await expect(page.getByText("로컬 데이터 대기 중")).toHaveCount(0);
});

test("empty local wiki does not imply completed wiki activity", async ({
  page,
}) => {
  await page.goto("/wiki?runtime=local");
  await expect(
    page.getByRole("heading", { name: "Wiki Browser" }),
  ).toBeVisible();
  await expect(
    page.getByText("No wiki pages captured yet.").first(),
  ).toBeVisible();
  await expect(
    page.getByText("LLM Wiki Curator updated a source-linked risk lesson."),
  ).toHaveCount(0);
  await expect(page.getByText("audit-wiki-btc-nvda-revision")).toHaveCount(0);
  await expect(page.getByText("stale quote warning")).toHaveCount(0);
});

test("desktop run detail renders empty local state without generated artifacts", async ({
  page,
}) => {
  await page.goto("/runs/run-btc-nvda?runtime=local");
  await expect(
    page.getByRole("heading", { name: "No research runs yet" }),
  ).toBeVisible();
  await expect(page.getByTestId("artifact-list")).toContainText("Artifacts");
  await expect(
    page.getByRole("link", { name: /Open BTC NVDA risk report/ }),
  ).toHaveCount(0);
});

test("command-backed runtime renders real non-fixture portfolio data", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.__PLUTUS_COMMAND_BRIDGE__ = async (envelope) => {
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
                  id: "position-aapl",
                  symbol: "AAPL",
                  name: "Apple Inc.",
                  quantity: 2,
                  averageCost: 175,
                  thesis: "Actual user-entered position",
                },
              ],
            },
          ],
          watchlists: [
            {
              id: "watchlist-real",
              name: "Real Watchlist",
              items: [{ id: "watch-msft", symbol: "MSFT" }],
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
    };
  });
  await page.goto("/dashboard");
  await expect(page.getByTestId("portfolio-core")).toContainText(
    "Real Portfolio",
  );
  await expect(page.getByTestId("portfolio-core")).toContainText("AAPL");
  await expect(page.getByText("BTC/NVDA")).toHaveCount(0);
  await page.getByRole("link", { name: "Watchlists" }).click();
  await expect(page.getByTestId("watchlist-default")).toContainText(
    "Real Watchlist",
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

  await page.addInitScript(() => {
    window.__PLUTUS_COMMAND_BRIDGE__ = async (envelope) => {
      if (envelope.command === "app.getSnapshot") {
        return {
          profileId: "profile-mobile",
          portfolios: [
            {
              id: "portfolio-mobile",
              name: "Mobile Portfolio",
              baseCurrency: "USD",
              positions: [
                {
                  id: "position-msft",
                  symbol: "MSFT",
                  name: "Microsoft",
                  quantity: 1,
                  averageCost: 400,
                  thesis: "Remote controlled portfolio",
                },
              ],
            },
          ],
          watchlists: [],
          runs: [],
          artifacts: [],
          memoryActivity: [],
          wikiPages: [],
          remoteDevices: [
            {
              name: "Mobile",
            },
          ],
        };
      }
      if (envelope.command === "remote.prepareUnlock") {
        return {
          sessionId: "session-mobile",
          sessionKeyRef: "secure://session-mobile",
          unlockProof: {
            method: "biometric",
            sessionKeyRef: "secure://session-mobile",
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
          data: {
            id: "run-mobile",
            status: "queued",
            portfolioId: "portfolio-mobile",
            selectedTeam: "portfolio_review_committee",
          },
        };
      }
      throw new Error(`Unexpected command ${envelope.command}`);
    };
  });

  await page.goto("/remote/dashboard?remote=connected");
  await expect(page.getByTestId("remote-state")).toContainText(
    "Connected to Plutus Mac",
  );
  await expect(
    page.getByRole("button", { name: "Start Remote Research Run" }),
  ).toBeEnabled();

  await page.goto("/remote/dashboard?remote=disconnected");
  await expect(page.getByTestId("remote-state")).toContainText("Disconnected");
  await expect(
    page.getByRole("button", { name: "Start Remote Research Run" }),
  ).toBeDisabled();

  await page.goto("/remote/dashboard?remote=stale");
  await expect(page.getByTestId("remote-state")).toContainText(
    "Stale snapshot",
  );
  await expect(
    page.getByRole("button", { name: "Start Remote Research Run" }),
  ).toBeDisabled();

  await page.goto("/remote/dashboard?remote=revoked");
  await expect(page.getByTestId("remote-state")).toContainText("Revoked");
  await expect(page.getByTestId("remote-command-error")).toContainText(
    "permission revoked",
  );
});

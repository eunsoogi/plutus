import { expect, test } from "@playwright/test";
import { configuredKoreanUpbitProvider } from "./plutus-mvp-helpers";

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

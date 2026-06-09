import { expect, test } from "@playwright/test";
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

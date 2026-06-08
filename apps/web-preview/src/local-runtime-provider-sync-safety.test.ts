import type {
  AppSnapshot,
  ProviderPortfolioSyncResult,
  TradingProviderConfig,
} from "@plutus/command-client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  callBridge,
  callProviderSyncBridge,
  connectedUpbitProvider,
  installBrowserState,
} from "./local-runtime.test-support";

describe("local web runtime provider portfolio sync safety", () => {
  beforeEach(() => {
    installBrowserState();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps a same-name manual portfolio intact when provider sync has no portfolio id", async () => {
    // Given: a user-created portfolio happens to use the default sync name.
    const manualPortfolio = await callBridge<{ id: string }>({
      command: "portfolios.create",
      args: [{ name: "Upbit Synced Holdings", baseCurrency: "KRW" }],
    });
    await callBridge({
      command: "portfolios.addPosition",
      args: [
        {
          averageCost: 180,
          costCurrency: "USD",
          portfolioId: manualPortfolio.id,
          quantity: 3,
          symbol: "AAPL",
          thesis: "Manual same-name holding.",
        },
      ],
    });
    await callBridge<TradingProviderConfig>({
      command: "providers.save",
      args: [connectedUpbitProvider],
    });

    // When: provider sync runs without an explicit portfolio selection.
    const syncResult =
      await callProviderSyncBridge<ProviderPortfolioSyncResult>({
        providerId: "upbit",
        portfolioName: "Upbit Synced Holdings",
        baseCurrency: "KRW",
        holdings: [
          {
            symbol: "btc-krw",
            name: "Bitcoin",
            quantity: 0.42,
            averageCost: 91000000,
            costCurrency: "KRW",
            thesis: "Imported from Upbit account balance.",
          },
        ],
      });

    // Then: sync creates a tagged provider portfolio and preserves manual data.
    const snapshot = await callBridge<AppSnapshot>({
      command: "app.getSnapshot",
      args: [],
    });
    const manual = snapshot.portfolios.find(
      (portfolio) => portfolio.id === manualPortfolio.id,
    );
    const synced = snapshot.portfolios.find(
      (portfolio) => portfolio.id === syncResult.portfolioId,
    );

    expect(syncResult.portfolioId).not.toBe(manualPortfolio.id);
    expect(snapshot.portfolios).toHaveLength(2);
    expect(manual?.positions).toEqual([
      expect.objectContaining({ symbol: "AAPL" }),
    ]);
    expect(manual?.positions).not.toEqual([
      expect.objectContaining({ symbol: "BTC-KRW" }),
    ]);
    expect(synced?.positions).toEqual([
      expect.objectContaining({ symbol: "BTC-KRW" }),
    ]);
  });
});

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

describe("local web runtime provider portfolio sync", () => {
  beforeEach(() => {
    installBrowserState();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("imports holdings from a configured trading provider into the local portfolio snapshot", async () => {
    await callBridge<TradingProviderConfig>({
      command: "providers.save",
      args: [connectedUpbitProvider],
    });

    const result = await callProviderSyncBridge<ProviderPortfolioSyncResult>({
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
        {
          symbol: "eth-krw",
          name: "Ethereum",
          quantity: 2.5,
          averageCost: 4800000,
          costCurrency: "KRW",
        },
      ],
    });

    const snapshot = await callBridge<AppSnapshot>({
      command: "app.getSnapshot",
      args: [],
    });
    expect(result).toMatchObject({
      importedCount: 2,
      providerId: "upbit",
      skippedCount: 0,
      positionSymbols: ["BTC-KRW", "ETH-KRW"],
    });
    expect(snapshot.portfolios).toEqual([
      expect.objectContaining({
        id: result.portfolioId,
        name: "Upbit Synced Holdings",
        baseCurrency: "KRW",
        positions: [
          expect.objectContaining({
            symbol: "BTC-KRW",
            quantity: 0.42,
            averageCost: 91000000,
            costCurrency: "KRW",
            thesis: "Imported from Upbit account balance.",
          }),
          expect.objectContaining({
            symbol: "ETH-KRW",
            quantity: 2.5,
            averageCost: 4800000,
            costCurrency: "KRW",
          }),
        ],
      }),
    ]);
    expect(JSON.stringify(snapshot)).not.toContain("apiKey");
    expect(JSON.stringify(snapshot)).not.toContain("secretKey");
  });

  it("reuses the provider-synced portfolio when localized names drift", async () => {
    await callBridge<TradingProviderConfig>({
      command: "providers.save",
      args: [connectedUpbitProvider],
    });

    const firstResult =
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
          },
        ],
      });

    const secondResult =
      await callProviderSyncBridge<ProviderPortfolioSyncResult>({
        providerId: "upbit",
        portfolioName: "Upbit 동기화 포트폴리오",
        baseCurrency: "KRW",
        holdings: [
          {
            symbol: "eth-krw",
            name: "Ethereum",
            quantity: 2.5,
            averageCost: 4800000,
            costCurrency: "KRW",
          },
        ],
      });

    const snapshot = await callBridge<AppSnapshot>({
      command: "app.getSnapshot",
      args: [],
    });
    expect(secondResult.portfolioId).toBe(firstResult.portfolioId);
    expect(snapshot.portfolios).toEqual([
      expect.objectContaining({
        id: firstResult.portfolioId,
        name: "Upbit 동기화 포트폴리오",
        baseCurrency: "KRW",
        positions: [
          expect.objectContaining({
            symbol: "ETH-KRW",
            quantity: 2.5,
            averageCost: 4800000,
            costCurrency: "KRW",
          }),
        ],
      }),
    ]);
    expect(JSON.stringify(snapshot.portfolios)).not.toContain("BTC-KRW");
  });

  it("rejects provider portfolio sync when the provider is not configured", async () => {
    const snapshot = await callBridge<AppSnapshot>({
      command: "app.getSnapshot",
      args: [],
    });
    const upbit = snapshot.tradingProviders?.find(
      (provider) => provider.providerId === "upbit",
    );

    expect(upbit?.health).toBe("not_configured");

    await expect(
      callProviderSyncBridge({
        providerId: "upbit",
        portfolioName: "Upbit Synced Holdings",
        baseCurrency: "KRW",
        holdings: [],
      }),
    ).rejects.toThrow("Configure provider upbit before syncing holdings.");
    const unchangedSnapshot = await callBridge<AppSnapshot>({
      command: "app.getSnapshot",
      args: [],
    });
    expect(unchangedSnapshot.portfolios).toEqual([]);
  });

  it("rejects malformed provider holdings before mutating local portfolio state", async () => {
    await callBridge<TradingProviderConfig>({
      command: "providers.save",
      args: [connectedUpbitProvider],
    });

    await expect(
      callProviderSyncBridge({
        providerId: "upbit",
        portfolioName: "Upbit Synced Holdings",
        baseCurrency: "KRW",
        holdings: [
          {
            symbol: "btc-krw",
            quantity: -0.5,
            averageCost: 91000000,
            costCurrency: "KRW",
          },
        ],
      }),
    ).rejects.toThrow("Synced holding quantity must be greater than 0.");
    const snapshot = await callBridge<AppSnapshot>({
      command: "app.getSnapshot",
      args: [],
    });
    expect(snapshot.portfolios).toEqual([]);
  });

  it("rejects a malformed holdings payload before falling back to preview data", async () => {
    await callBridge<TradingProviderConfig>({
      command: "providers.save",
      args: [connectedUpbitProvider],
    });

    await expect(
      callBridge({
        command: "portfolios.syncFromProvider",
        args: [
          {
            providerId: "upbit",
            portfolioName: "Upbit Synced Holdings",
            baseCurrency: "KRW",
            holdings: "btc-krw",
          },
        ],
      }),
    ).rejects.toThrow("Provider sync holdings must be an array.");
    const snapshot = await callBridge<AppSnapshot>({
      command: "app.getSnapshot",
      args: [],
    });
    expect(snapshot.portfolios).toEqual([]);
  });

  it("rejects provider portfolio sync when the requested portfolio is missing", async () => {
    await callBridge<TradingProviderConfig>({
      command: "providers.save",
      args: [connectedUpbitProvider],
    });

    await expect(
      callProviderSyncBridge({
        providerId: "upbit",
        portfolioId: "portfolio-missing",
        portfolioName: "Upbit Synced Holdings",
        baseCurrency: "KRW",
        holdings: [
          {
            symbol: "btc-krw",
            quantity: 0.42,
            averageCost: 91000000,
            costCurrency: "KRW",
          },
        ],
      }),
    ).rejects.toThrow("Portfolio not found");
    const snapshot = await callBridge<AppSnapshot>({
      command: "app.getSnapshot",
      args: [],
    });
    expect(snapshot.portfolios).toEqual([]);
  });
});

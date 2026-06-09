import { beforeEach, describe, expect, it } from "vitest";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  PAST_PERFORMANCE_CAVEAT,
  btcMovingAverageSpec,
  createMovingAverageCrossoverStrategy,
} from "@plutus/backtest";
import { fixtureIds } from "@plutus/test-fixtures";
import { LocalToolRouter, createInMemoryToolRuntime } from "./index";
import { makeRunContext } from "./test-support";

describe("local tool router", () => {
  beforeEach(() => {
    process.env.PLUTUS_ALLOW_FIXTURE_TOOLS = "1";
  });

  it("serves market data through the data package with provider failover metadata", async () => {
    const router = new LocalToolRouter();
    const quote = await router.call(makeRunContext("market_data_researcher"), {
      namespace: "plutus_market_data",
      tool: "get_quote",
      input: {
        symbol: "BTC",
        providerPreference: ["yahoo-compatible", "coingecko"],
      },
    });

    expect(quote.ok).toBe(true);
    expect((quote.data as { quote: { provider: string } }).quote.provider).toBe(
      "coingecko",
    );
    expect(
      (
        quote.data as {
          failover: { attemptedProviders: string[]; warnings: unknown[] };
        }
      ).failover.attemptedProviders,
    ).toEqual(["yahoo-compatible", "coingecko"]);
    expect(quote.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "provider_unsupported_asset_type" }),
      ]),
    );
    const delayedQuote = await router.call(
      makeRunContext("market_data_researcher"),
      {
        namespace: "plutus_market_data",
        tool: "get_quote",
        input: { symbol: "SPY" },
      },
    );
    expect(
      (
        delayedQuote.data as {
          failover: { selectedProvider: string; attemptedProviders: string[] };
        }
      ).failover,
    ).toMatchObject({
      selectedProvider: "fixture",
      attemptedProviders: ["fixture"],
    });
    expect(delayedQuote.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "provider_freshness_warning" }),
      ]),
    );

    const candles = await router.call(makeRunContext("technical_analyst"), {
      namespace: "plutus_market_data",
      tool: "get_ohlcv",
      input: { symbol: "BTC", interval: "1d" },
    });
    expect(candles.ok).toBe(true);
    expect(
      (candles.data as { candles: unknown[] }).candles.length,
    ).toBeGreaterThan(0);

    const catalog = await router.call(
      makeRunContext("market_data_researcher"),
      {
        namespace: "plutus_market_data",
        tool: "search_instruments",
        input: { query: "coin", assetTypes: ["crypto"], regions: ["global"] },
      },
    );
    expect(
      (
        catalog.data as {
          instruments: Array<{
            symbol: string;
            sourceRef: unknown;
            freshness: { delayStatus: string };
          }>;
        }
      ).instruments,
    ).toEqual([
      expect.objectContaining({
        symbol: "BTC",
        sourceRef: expect.objectContaining({ provider: "fixture" }),
        freshness: expect.objectContaining({ delayStatus: "delayed" }),
      }),
    ]);

    const unsupported = await router.call(
      makeRunContext("market_data_researcher"),
      {
        namespace: "plutus_market_data",
        tool: "get_quote",
        input: { symbol: "DOGE" },
      },
    );
    expect(unsupported.ok).toBe(true);
    expect(unsupported.data).toBeUndefined();
    expect(unsupported.warnings).toContainEqual(
      expect.objectContaining({
        code: "unsupported_symbol",
        severity: "blocking",
      }),
    );

    const syntheticBlocked = await router.call(
      makeRunContext("technical_analyst"),
      {
        namespace: "plutus_market_data",
        tool: "get_ohlcv",
        input: { symbol: "AAPL", interval: "1d" },
      },
    );
    expect(syntheticBlocked.data).toBeUndefined();
    expect(syntheticBlocked.warnings).toContainEqual(
      expect.objectContaining({
        code: "synthetic_market_data_blocked",
        severity: "blocking",
      }),
    );
  });
});

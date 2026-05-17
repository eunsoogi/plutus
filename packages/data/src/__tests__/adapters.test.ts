import {
  createCcxtFixtureProvider,
  createCoinGeckoProvider,
  createYahooCompatibleProvider,
  normalizeCandles,
} from "../index";

describe("@plutus/data provider adapters", () => {
  it("returns deterministic Yahoo-compatible equity quotes without network calls", async () => {
    let fetchCalls = 0;
    const provider = createYahooCompatibleProvider({
      fetch: async () => {
        fetchCalls += 1;
        throw new Error("network should be opt-in");
      },
    });

    const quote = await provider.getQuote!({
      instrumentId: "018f3f5d-0000-7000-8000-000000000101",
      symbol: "NVDA",
      assetType: "stock",
      currency: "USD",
    });

    expect(fetchCalls).toBe(0);
    expect(quote.provider).toBe("yahoo-compatible");
    expect(quote.price).toBe(924.79);
    expect(quote.currency).toBe("USD");
    expect(quote.freshness.delayStatus).toBe("delayed");
    expect(quote.freshness.warnings).toContainEqual(
      expect.objectContaining({ code: "provider_delayed" }),
    );
  });

  it("normalizes CoinGecko crypto market data from an injected client", async () => {
    const provider = createCoinGeckoProvider({
      client: {
        async getMarket(symbols) {
          expect(symbols).toEqual(["bitcoin"]);
          return [
            {
              id: "bitcoin",
              symbol: "btc",
              current_price: 67120,
              market_cap: 1320000000000,
              total_volume: 21000000000,
              last_updated: "2026-05-17T00:00:00.000Z",
            },
          ];
        },
      },
    });

    const quote = await provider.getQuote!({
      instrumentId: "018f3f5d-0000-7000-8000-000000000201",
      symbol: "BTC",
      assetType: "crypto",
      currency: "USD",
      providerRefs: { coingecko: "bitcoin" },
    });

    expect(quote.provider).toBe("coingecko");
    expect(quote.price).toBe(67120);
    expect(quote.volume).toBe(21000000000);
    expect(quote.freshness.delayStatus).toBe("realtime");
  });

  it("normalizes CCXT-compatible fixture candles with source metadata", async () => {
    const provider = createCcxtFixtureProvider();

    const candles = await provider.getOhlcv!({
      instrumentId: "018f3f5d-0000-7000-8000-000000000201",
      symbol: "BTC/USDC",
      assetType: "crypto",
      currency: "USD",
      interval: "1d",
      start: "2026-05-15T00:00:00.000Z",
      end: "2026-05-17T00:00:00.000Z",
    });

    expect(candles).toHaveLength(2);
    expect(candles[1]).toEqual(
      expect.objectContaining({
        provider: "ccxt-fixture",
        interval: "1d",
        open: 66400,
        close: 67120,
      }),
    );
    expect(candles[1]?.sourceMetadata).toEqual(
      expect.objectContaining({ exchange: "fixture-exchange" }),
    );
  });

  it("sorts and validates normalized candles deterministically", () => {
    const candles = normalizeCandles({
      instrumentId: "018f3f5d-0000-7000-8000-000000000201",
      provider: "test",
      interval: "1d",
      timezone: "UTC",
      rows: [
        ["2026-05-17T00:00:00.000Z", 2, 3, 1, 2.5, 10],
        ["2026-05-16T00:00:00.000Z", 1, 2, 0.5, 1.5, 8],
      ],
    });

    expect(candles.map((candle) => candle.timestamp)).toEqual([
      "2026-05-16T00:00:00.000Z",
      "2026-05-17T00:00:00.000Z",
    ]);
    expect(candles[0]?.id).toMatch(/^018f3f5d-0000-7000-8000-[0-9a-f]{12}$/);
  });
});

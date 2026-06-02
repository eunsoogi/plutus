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

  it("normalizes Yahoo-compatible network candles from an injected chart response", async () => {
    // Given: network mode is enabled with a Yahoo chart-compatible fetch.
    const requestedUrls: string[] = [];
    const provider = createYahooCompatibleProvider({
      useNetwork: true,
      fetch: async (input) => {
        const url = input instanceof URL ? input : new URL(String(input));
        requestedUrls.push(url.toString());
        return new Response(
          JSON.stringify({
            chart: {
              result: [
                {
                  timestamp: [1778803200, 1778889600],
                  meta: { timezone: "America/New_York" },
                  indicators: {
                    quote: [
                      {
                        open: [922, 924],
                        high: [930, 932],
                        low: [918, 921],
                        close: [928, 929.5],
                        volume: [41000000, 39000000],
                      },
                    ],
                    adjclose: [{ adjclose: [927.8, 929.25] }],
                  },
                },
              ],
            },
          }),
        );
      },
    });
    const getOhlcv = provider.getOhlcv;
    if (!getOhlcv) {
      throw new Error("Yahoo-compatible provider must expose getOhlcv.");
    }

    // When: the provider is asked for network candles.
    const candles = await getOhlcv({
      instrumentId: "018f3f5d-0000-7000-8000-000000000101",
      symbol: "NVDA",
      assetType: "stock",
      currency: "USD",
      interval: "1d",
      start: "2026-05-15T00:00:00.000Z",
      end: "2026-05-17T00:00:00.000Z",
    });

    // Then: the Yahoo chart response is normalized into price bars.
    expect(requestedUrls[0]).toContain("/v8/finance/chart/NVDA");
    expect(requestedUrls[0]).toContain("interval=1d");
    expect(requestedUrls[0]).toContain("period1=1778803200");
    expect(candles).toHaveLength(2);
    expect(candles[0]).toEqual(
      expect.objectContaining({
        provider: "yahoo-compatible",
        interval: "1d",
        timestamp: "2026-05-15T00:00:00.000Z",
        open: 922,
        close: 928,
        adjustedClose: 927.8,
        sourceMetadata: expect.objectContaining({
          source: "yahoo-compatible-chart",
          timezone: "America/New_York",
        }),
      }),
    );
  });

  it("normalizes Yahoo-compatible network candles without adjusted close values", async () => {
    // Given: Yahoo chart returns quote candles without an adjclose indicator.
    const provider = createYahooCompatibleProvider({
      useNetwork: true,
      fetch: async () =>
        new Response(
          JSON.stringify({
            chart: {
              result: [
                {
                  timestamp: [1778803200],
                  meta: { timezone: "America/New_York" },
                  indicators: {
                    quote: [
                      {
                        open: [922],
                        high: [930],
                        low: [918],
                        close: [928],
                        volume: [41000000],
                      },
                    ],
                  },
                },
              ],
            },
          }),
        ),
    });
    const getOhlcv = provider.getOhlcv;
    if (!getOhlcv) {
      throw new Error("Yahoo-compatible provider must expose getOhlcv.");
    }

    // When: the provider is asked for network candles.
    const candles = await getOhlcv({
      instrumentId: "018f3f5d-0000-7000-8000-000000000101",
      symbol: "NVDA",
      assetType: "stock",
      currency: "USD",
      interval: "1d",
      start: "2026-05-15T00:00:00.000Z",
      end: "2026-05-16T00:00:00.000Z",
    });

    // Then: quote-only chart rows still normalize with nullable adjusted close.
    expect(candles).toHaveLength(1);
    expect(candles[0]).toEqual(
      expect.objectContaining({
        timestamp: "2026-05-15T00:00:00.000Z",
        close: 928,
        adjustedClose: null,
      }),
    );
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

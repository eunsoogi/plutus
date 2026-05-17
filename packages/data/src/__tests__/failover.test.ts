import {
  createMarketDataService,
  makeProviderWarning,
  type MarketDataProvider,
} from "../index";

const instrument = {
  instrumentId: "018f3f5d-0000-7000-8000-000000000201",
  symbol: "BTC",
  assetType: "crypto" as const,
  currency: "USD",
};

function provider(overrides: Partial<MarketDataProvider>): MarketDataProvider {
  return {
    id: "test-provider",
    label: "Test Provider",
    supportedAssetTypes: ["crypto"],
    supportedData: ["quote", "ohlcv"],
    async getHealth() {
      return {
        provider: "test-provider",
        status: "available",
        latencyMs: 1,
        quotaRemaining: null,
        checkedAt: "2026-05-17T00:00:00.000Z",
        warnings: [],
      };
    },
    async getQuote() {
      throw new Error("not implemented");
    },
    async getOhlcv() {
      return [];
    },
    ...overrides,
  };
}

describe("@plutus/data market data failover", () => {
  it("fails over when the preferred provider is rate limited", async () => {
    const service = createMarketDataService({
      providers: [
        provider({
          id: "primary",
          async getHealth() {
            return {
              provider: "primary",
              status: "rate_limited",
              latencyMs: 2,
              quotaRemaining: 0,
              checkedAt: "2026-05-17T00:00:00.000Z",
              warnings: [
                makeProviderWarning(
                  "provider_rate_limited",
                  "warning",
                  "Primary quota exhausted.",
                ),
              ],
            };
          },
        }),
        provider({
          id: "secondary",
          async getQuote(request) {
            return {
              id: "018f3f5d-0000-7000-8000-000000000902",
              instrumentId: request.instrumentId,
              provider: "secondary",
              asOf: "2026-05-17T00:00:00.000Z",
              price: 67120,
              currency: "USD",
              bid: null,
              ask: null,
              volume: 21000000000,
              delayStatus: "realtime",
              warnings: [],
              freshness: {
                provider: "secondary",
                asOf: "2026-05-17T00:00:00.000Z",
                receivedAt: "2026-05-17T00:00:01.000Z",
                delayStatus: "realtime",
                warnings: [],
              },
            };
          },
        }),
      ],
    });

    const result = await service.getQuote({
      ...instrument,
      providerPreference: ["primary", "secondary"],
    });

    expect(result.quote.provider).toBe("secondary");
    expect(result.failover.attemptedProviders).toEqual([
      "primary",
      "secondary",
    ]);
    expect(result.failover.warnings).toContainEqual(
      expect.objectContaining({ code: "provider_rate_limited" }),
    );
  });

  it("continues failover when provider data is stale", async () => {
    const service = createMarketDataService({
      providers: [
        provider({
          id: "stale-provider",
          async getQuote(request) {
            return {
              id: "018f3f5d-0000-7000-8000-000000000903",
              instrumentId: request.instrumentId,
              provider: "stale-provider",
              asOf: "2026-05-16T00:00:00.000Z",
              price: 66000,
              currency: "USD",
              bid: null,
              ask: null,
              volume: null,
              delayStatus: "stale",
              warnings: [
                makeProviderWarning(
                  "provider_stale",
                  "warning",
                  "Stale fixture.",
                ),
              ],
              freshness: {
                provider: "stale-provider",
                asOf: "2026-05-16T00:00:00.000Z",
                receivedAt: "2026-05-17T00:00:00.000Z",
                delayStatus: "stale",
                warnings: [
                  makeProviderWarning(
                    "provider_stale",
                    "warning",
                    "Stale fixture.",
                  ),
                ],
              },
            };
          },
        }),
        provider({
          id: "fresh-provider",
          async getQuote(request) {
            return {
              id: "018f3f5d-0000-7000-8000-000000000904",
              instrumentId: request.instrumentId,
              provider: "fresh-provider",
              asOf: "2026-05-17T00:00:00.000Z",
              price: 67120,
              currency: "USD",
              bid: null,
              ask: null,
              volume: 21000000000,
              delayStatus: "realtime",
              warnings: [],
              freshness: {
                provider: "fresh-provider",
                asOf: "2026-05-17T00:00:00.000Z",
                receivedAt: "2026-05-17T00:00:01.000Z",
                delayStatus: "realtime",
                warnings: [],
              },
            };
          },
        }),
      ],
      failover: { acceptStale: false },
    });

    const result = await service.getQuote(instrument);

    expect(result.quote.provider).toBe("fresh-provider");
    expect(result.failover.warnings).toContainEqual(
      expect.objectContaining({ code: "provider_stale" }),
    );
  });

  it("returns blocking warnings when no free provider can satisfy the request", async () => {
    const service = createMarketDataService({
      providers: [
        provider({
          id: "equity-only",
          supportedAssetTypes: ["stock"],
        }),
      ],
    });

    await expect(service.getQuote(instrument)).rejects.toMatchObject({
      code: "market_data_unavailable",
      warnings: [
        expect.objectContaining({
          code: "provider_unsupported_asset_type",
          severity: "warning",
        }),
        expect.objectContaining({
          code: "market_data_unavailable",
          severity: "blocking",
        }),
      ],
    });
  });
});

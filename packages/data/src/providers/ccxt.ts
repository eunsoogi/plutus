import type { MarketDataProvider } from "./provider";
import { normalizeCandles, type RawCandleRow } from "../normalization/candles";

export type CcxtCompatibleClient = {
  fetchOHLCV(
    symbol: string,
    interval: string,
    since: number,
    limit?: number,
  ): Promise<RawCandleRow[]>;
};

export type CcxtFixtureOptions = {
  client?: CcxtCompatibleClient;
  exchange?: string;
};

const provider = "ccxt-fixture";
const exchange = "fixture-exchange";

const DEFAULT_ROWS: RawCandleRow[] = [
  [Date.parse("2026-05-15T00:00:00.000Z"), 66000, 67200, 65500, 66400, 18000],
  [Date.parse("2026-05-16T00:00:00.000Z"), 66400, 67800, 66000, 67120, 21000],
];

export function createCcxtFixtureProvider(
  options: CcxtFixtureOptions = {},
): MarketDataProvider {
  const exchangeName = options.exchange ?? exchange;
  const client =
    options.client ??
    ({
      async fetchOHLCV() {
        return DEFAULT_ROWS;
      },
    } satisfies CcxtCompatibleClient);

  return {
    id: provider,
    label: "CCXT-compatible crypto OHLCV fixture",
    supportedAssetTypes: ["crypto", "stablecoin"],
    supportedData: ["ohlcv"],
    async getHealth() {
      return {
        provider,
        status: "available",
        latencyMs: null,
        quotaRemaining: null,
        checkedAt: "2026-05-17T00:00:02.000Z",
        warnings: [],
      };
    },
    async getOhlcv(request) {
      const rows = await client.fetchOHLCV(
        request.symbol,
        request.interval,
        Date.parse(request.start),
      );
      return normalizeCandles({
        instrumentId: request.instrumentId,
        provider,
        interval: request.interval,
        rows,
        sourceMetadata: {
          exchange: exchangeName,
          symbol: request.symbol,
          requestedStart: request.start,
          requestedEnd: request.end,
        },
      });
    },
  };
}

export const createCcxtCompatibleFixtureProvider = createCcxtFixtureProvider;

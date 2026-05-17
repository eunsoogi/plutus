import { QuoteSnapshotSchema, type QuoteSnapshot } from "@plutus/domain";

import {
  makeProviderWarning,
  resolveProviderSymbol,
  type MarketDataProvider,
  type ProviderInstrumentRequest,
} from "./provider";
import { normalizeCandles } from "../normalization/candles";

type YahooFixture = {
  regularMarketPrice: number;
  currency: string;
  bid: number | null;
  ask: number | null;
  regularMarketVolume: number | null;
  regularMarketTime: string;
};

export type YahooCompatibleOptions = {
  fetch?: typeof fetch;
  useNetwork?: boolean;
  endpoint?: string;
  fixtures?: Record<string, YahooFixture>;
};

const DEFAULT_YAHOO_FIXTURES: Record<string, YahooFixture> = {
  NVDA: {
    regularMarketPrice: 924.79,
    currency: "USD",
    bid: 924.5,
    ask: 925,
    regularMarketVolume: 42000000,
    regularMarketTime: "2026-05-16T23:45:00.000Z",
  },
  AAPL: {
    regularMarketPrice: 189.98,
    currency: "USD",
    bid: 189.9,
    ask: 190.1,
    regularMarketVolume: 61000000,
    regularMarketTime: "2026-05-16T23:45:00.000Z",
  },
  SPY: {
    regularMarketPrice: 525.12,
    currency: "USD",
    bid: 525,
    ask: 525.2,
    regularMarketVolume: 77000000,
    regularMarketTime: "2026-05-16T23:45:00.000Z",
  },
};

const provider = "yahoo-compatible";
const receivedAt = "2026-05-17T00:00:02.000Z";

function quoteId(instrumentId: string): string {
  return instrumentId.replace(/.$/, "1");
}

async function fetchYahooQuote(
  request: ProviderInstrumentRequest,
  options: YahooCompatibleOptions,
): Promise<YahooFixture> {
  if (!options.useNetwork) {
    const fixture = (options.fixtures ?? DEFAULT_YAHOO_FIXTURES)[
      resolveProviderSymbol(request, provider)
    ];
    if (!fixture) {
      throw new Error(`No Yahoo-compatible fixture for ${request.symbol}.`);
    }
    return fixture;
  }

  if (!options.fetch) {
    throw new Error(
      "Yahoo-compatible network mode requires an injected fetch.",
    );
  }

  const url = new URL(
    options.endpoint ?? "https://query1.finance.yahoo.com/v7/finance/quote",
  );
  url.searchParams.set("symbols", resolveProviderSymbol(request, provider));
  const response = await options.fetch(url);
  const payload = (await response.json()) as {
    quoteResponse?: { result?: YahooFixture[] };
  };
  const quote = payload.quoteResponse?.result?.[0];
  if (!quote) {
    throw new Error(
      `Yahoo-compatible provider returned no quote for ${request.symbol}.`,
    );
  }
  return quote;
}

export function createYahooCompatibleProvider(
  options: YahooCompatibleOptions = {},
): MarketDataProvider {
  return {
    id: provider,
    label: "Yahoo-compatible free market data",
    supportedAssetTypes: ["stock", "etf"],
    supportedData: ["quote", "ohlcv"],
    async getHealth() {
      return {
        provider,
        status: "available",
        latencyMs: null,
        quotaRemaining: null,
        checkedAt: receivedAt,
        warnings: [],
      };
    },
    async getQuote(request): Promise<QuoteSnapshot> {
      const raw = await fetchYahooQuote(request, options);
      const warnings = [
        makeProviderWarning(
          "provider_delayed",
          "info",
          "Yahoo-compatible free quote may be delayed.",
        ),
      ];
      return QuoteSnapshotSchema.parse({
        id: quoteId(request.instrumentId),
        instrumentId: request.instrumentId,
        provider,
        asOf: raw.regularMarketTime,
        price: raw.regularMarketPrice,
        currency: raw.currency,
        bid: raw.bid,
        ask: raw.ask,
        volume: raw.regularMarketVolume,
        delayStatus: "delayed",
        warnings,
        freshness: {
          provider,
          asOf: raw.regularMarketTime,
          receivedAt,
          delayStatus: "delayed",
          warnings,
        },
      });
    },
    async getOhlcv(request) {
      return normalizeCandles({
        instrumentId: request.instrumentId,
        provider,
        interval: request.interval,
        rows: [
          [
            Date.parse("2026-05-15T00:00:00.000Z"),
            910,
            930,
            905,
            924.79,
            42000000,
          ],
          [
            Date.parse("2026-05-16T00:00:00.000Z"),
            922,
            928,
            916,
            924.79,
            36000000,
          ],
        ],
        sourceMetadata: { source: "yahoo-compatible-fixture" },
      });
    },
  };
}

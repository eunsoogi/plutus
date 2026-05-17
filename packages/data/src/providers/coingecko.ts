import { QuoteSnapshotSchema, type QuoteSnapshot } from "@plutus/domain";

import {
  resolveProviderSymbol,
  type MarketDataProvider,
  type ProviderInstrumentRequest,
} from "./provider";

type CoinGeckoMarket = {
  id: string;
  symbol: string;
  current_price: number;
  market_cap: number | null;
  total_volume: number | null;
  last_updated: string;
};

export type CoinGeckoClient = {
  getMarket(symbols: string[], currency: string): Promise<CoinGeckoMarket[]>;
};

export type CoinGeckoOptions = {
  client?: CoinGeckoClient;
  fixtures?: Record<string, CoinGeckoMarket>;
};

const provider = "coingecko";
const receivedAt = "2026-05-17T00:00:02.000Z";

const DEFAULT_FIXTURES: Record<string, CoinGeckoMarket> = {
  bitcoin: {
    id: "bitcoin",
    symbol: "btc",
    current_price: 67120,
    market_cap: 1320000000000,
    total_volume: 21000000000,
    last_updated: "2026-05-17T00:00:00.000Z",
  },
  ethereum: {
    id: "ethereum",
    symbol: "eth",
    current_price: 3220,
    market_cap: 386000000000,
    total_volume: 11000000000,
    last_updated: "2026-05-17T00:00:00.000Z",
  },
};

function coingeckoId(request: ProviderInstrumentRequest): string {
  return (
    request.providerRefs?.coingecko ??
    (resolveProviderSymbol(request, provider).toUpperCase() === "BTC"
      ? "bitcoin"
      : resolveProviderSymbol(request, provider).toLowerCase())
  );
}

function quoteId(instrumentId: string): string {
  return instrumentId.replace(/.$/, "2");
}

export function createCoinGeckoProvider(
  options: CoinGeckoOptions = {},
): MarketDataProvider {
  const client =
    options.client ??
    ({
      async getMarket(symbols: string[]) {
        return symbols.flatMap((symbol) => {
          const fixture = (options.fixtures ?? DEFAULT_FIXTURES)[symbol];
          return fixture ? [fixture] : [];
        });
      },
    } satisfies CoinGeckoClient);

  return {
    id: provider,
    label: "CoinGecko free crypto market data",
    supportedAssetTypes: ["crypto", "stablecoin"],
    supportedData: ["quote"],
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
      const id = coingeckoId(request);
      const market = (await client.getMarket([id], request.currency))[0];
      if (!market) {
        throw new Error(`CoinGecko fixture missing for ${id}.`);
      }

      return QuoteSnapshotSchema.parse({
        id: quoteId(request.instrumentId),
        instrumentId: request.instrumentId,
        provider,
        asOf: market.last_updated,
        price: market.current_price,
        currency: request.currency,
        bid: null,
        ask: null,
        volume: market.total_volume,
        delayStatus: "realtime",
        warnings: [],
        freshness: {
          provider,
          asOf: market.last_updated,
          receivedAt,
          delayStatus: "realtime",
          warnings: [],
        },
      });
    },
  };
}

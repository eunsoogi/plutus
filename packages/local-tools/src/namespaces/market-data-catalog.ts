import {
  createCcxtFixtureProvider,
  createCoinGeckoProvider,
  createMarketDataService,
  createYahooCompatibleProvider,
  type OhlcvRequest,
  type ProviderInstrumentRequest,
} from "@plutus/data";

import { allowFixtureTools } from "./common";

const instrumentIds = {
  AAPL: "018f3f5d-0000-7000-8000-000000000101",
  NVDA: "018f3f5d-0000-7000-8000-000000000102",
  BTC: "018f3f5d-0000-7000-8000-000000000103",
  ETH: "018f3f5d-0000-7000-8000-000000000104",
  USDC: "018f3f5d-0000-7000-8000-000000000105",
  USD: "018f3f5d-0000-7000-8000-000000000106",
  SPY: "018f3f5d-0000-7000-8000-000000000107",
  QQQ: "018f3f5d-0000-7000-8000-000000000108",
} as const;

export const instrumentCatalog: Record<
  string,
  ProviderInstrumentRequest & { displayName: string; region: string }
> = {
  AAPL: {
    instrumentId: instrumentIds.AAPL,
    symbol: "AAPL",
    assetType: "stock",
    currency: "USD",
    providerRefs: { fixture: "AAPL", "yahoo-compatible": "AAPL" },
    displayName: "Apple Inc.",
    region: "US",
  },
  NVDA: {
    instrumentId: instrumentIds.NVDA,
    symbol: "NVDA",
    assetType: "stock",
    currency: "USD",
    providerRefs: { "yahoo-compatible": "NVDA" },
    displayName: "NVIDIA Corporation",
    region: "US",
  },
  BTC: {
    instrumentId: instrumentIds.BTC,
    symbol: "BTC",
    assetType: "crypto",
    currency: "USD",
    providerRefs: { coingecko: "bitcoin", "ccxt-fixture": "BTC/USD" },
    displayName: "Bitcoin",
    region: "global",
  },
  ETH: {
    instrumentId: instrumentIds.ETH,
    symbol: "ETH",
    assetType: "crypto",
    currency: "USD",
    providerRefs: { fixture: "ETH-USD", coingecko: "ethereum" },
    displayName: "Ethereum",
    region: "global",
  },
  USDC: {
    instrumentId: instrumentIds.USDC,
    symbol: "USDC",
    assetType: "stablecoin",
    currency: "USD",
    providerRefs: { fixture: "USDC-USD" },
    displayName: "USD Coin",
    region: "global",
  },
  USD: {
    instrumentId: instrumentIds.USD,
    symbol: "USD",
    assetType: "cash",
    currency: "USD",
    providerRefs: { fixture: "USD-CASH" },
    displayName: "US Dollar Cash",
    region: "US",
  },
  SPY: {
    instrumentId: instrumentIds.SPY,
    symbol: "SPY",
    assetType: "etf",
    currency: "USD",
    providerRefs: { fixture: "SPY", "yahoo-compatible": "SPY" },
    displayName: "SPDR S&P 500 ETF Trust",
    region: "US",
  },
  QQQ: {
    instrumentId: instrumentIds.QQQ,
    symbol: "QQQ",
    assetType: "etf",
    currency: "USD",
    providerRefs: { fixture: "QQQ", "yahoo-compatible": "QQQ" },
    displayName: "Invesco QQQ Trust",
    region: "US",
  },
};

export function marketDataService() {
  if (allowFixtureMarketData()) {
    return createMarketDataService({
      providers: [
        createYahooCompatibleProvider(),
        createCoinGeckoProvider(),
        createCcxtFixtureProvider(),
      ],
      failover: { acceptStale: true },
    });
  }
  const providers = [
    createYahooCompatibleProvider({
      useNetwork: true,
      fetch: globalThis.fetch,
    }),
    createCoinGeckoProvider({
      client: {
        async getMarket(symbols, currency) {
          const url = new URL("https://api.coingecko.com/api/v3/coins/markets");
          url.searchParams.set("vs_currency", currency.toLowerCase());
          url.searchParams.set("ids", symbols.join(","));
          const response = await fetch(url);
          if (!response.ok) return [];
          return (await response.json()) as any[];
        },
      },
    }),
  ];
  return createMarketDataService({ providers });
}

export function allowFixtureMarketData() {
  return allowFixtureTools();
}

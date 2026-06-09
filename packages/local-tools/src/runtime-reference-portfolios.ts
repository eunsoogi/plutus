import {
  fixtureIds,
  instrumentMap,
  type RuntimePortfolio,
  type RuntimeSymbol,
  type RuntimeWatchlist,
  type RuntimeWatchlistItem,
} from "./runtime-reference-types";

export const corePortfolio: RuntimePortfolio = {
  id: fixtureIds.corePortfolio,
  profileId: fixtureIds.profile,
  name: "Core",
  baseCurrency: "USD",
  benchmarkId: fixtureIds.SPY,
  riskProfile: {
    maxSingleAssetWeightPct: 25,
    maxCryptoWeightPct: 20,
  },
  positions: [
    position(
      "AAPL",
      12,
      185,
      "growth_equity",
      "Durable consumer platform exposure.",
    ),
    position(
      "NVDA",
      8,
      760,
      "ai_semiconductor",
      "AI infrastructure upside with valuation risk.",
    ),
    position(
      "BTC",
      0.42,
      63000,
      "digital_asset",
      "Long-term store-of-value exposure.",
    ),
    position(
      "ETH",
      2.4,
      3100,
      "digital_asset",
      "Smart-contract platform exposure.",
    ),
    position("USDC", 2500, 1, "cash_equivalent", "Stablecoin dry powder."),
    position("USD", 5000, 1, "cash", "Fiat cash reserve."),
  ],
};

export const defaultWatchlist: RuntimeWatchlist = {
  id: fixtureIds.defaultWatchlist,
  profileId: fixtureIds.profile,
  name: "Default",
  items: [
    watchlistItem("SPY", 1, "Broad market benchmark."),
    watchlistItem("QQQ", 2, "Growth and technology benchmark."),
    watchlistItem("BTC", 3, "Digital asset benchmark."),
    watchlistItem("ETH", 4, "Crypto platform comparison."),
    watchlistItem("NVDA", 5, "AI concentration watch."),
  ],
};

export const marketData = {
  quotes: [
    quote("NVDA", "realtime"),
    quote("SPY", "delayed"),
    quote("BTC", "stale"),
    quote("ETH", "unknown"),
  ],
} as const;

function position(
  symbol: RuntimeSymbol,
  quantity: number,
  averageCost: number,
  riskBucket: string,
  thesis: string,
) {
  const index = Object.keys(instrumentMap)
    .indexOf(symbol)
    .toString()
    .padStart(2, "0");
  return {
    id: `018f3f5d-0000-7000-8000-0000000002${index}`,
    portfolioId: fixtureIds.corePortfolio,
    accountId:
      symbol === "USD" ? fixtureIds.cashAccount : fixtureIds.manualAccount,
    instrumentId: instrumentMap[symbol].id,
    symbol,
    quantity,
    averageCost,
    costCurrency: "USD",
    feesTotal: 0,
    acquiredAt: "2026-01-15T00:00:00.000Z",
    riskBucket,
    tags: symbol === "BTC" || symbol === "NVDA" ? ["concentration-review"] : [],
    thesis,
  };
}

function watchlistItem(
  symbol: RuntimeSymbol,
  index: number,
  triggerNote: string,
): RuntimeWatchlistItem {
  return {
    id: `018f3f5d-0000-7000-8000-0000000004${index.toString().padStart(2, "0")}`,
    watchlistId: fixtureIds.defaultWatchlist,
    instrumentId: instrumentMap[symbol].id,
    symbol,
    triggerNote,
    targetZone: {},
  };
}

function quote(symbol: RuntimeSymbol, delayStatus: string) {
  const prices: Record<RuntimeSymbol, number> = {
    AAPL: 212.5,
    NVDA: 924.79,
    BTC: 67120,
    ETH: 3220,
    USDC: 1,
    USD: 1,
    SPY: 525.12,
    QQQ: 452.4,
  };
  return {
    instrumentId: instrumentMap[symbol].id,
    provider: "runtime_reference",
    price: prices[symbol],
    currency: "USD",
    delayStatus,
  };
}

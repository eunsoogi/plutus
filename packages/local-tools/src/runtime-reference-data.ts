export const fixtureIds = {
  profile: "018f3f5d-0000-7000-8000-000000000001",
  corePortfolio: "018f3f5d-0000-7000-8000-000000000002",
  manualAccount: "018f3f5d-0000-7000-8000-000000000003",
  cashAccount: "018f3f5d-0000-7000-8000-000000000004",
  defaultWatchlist: "018f3f5d-0000-7000-8000-000000000005",
  AAPL: "018f3f5d-0000-7000-8000-000000000101",
  NVDA: "018f3f5d-0000-7000-8000-000000000102",
  BTC: "018f3f5d-0000-7000-8000-000000000103",
  ETH: "018f3f5d-0000-7000-8000-000000000104",
  USDC: "018f3f5d-0000-7000-8000-000000000105",
  USD: "018f3f5d-0000-7000-8000-000000000106",
  SPY: "018f3f5d-0000-7000-8000-000000000107",
  QQQ: "018f3f5d-0000-7000-8000-000000000108",
} as const;

type RuntimeSymbol =
  | "AAPL"
  | "NVDA"
  | "BTC"
  | "ETH"
  | "USDC"
  | "USD"
  | "SPY"
  | "QQQ";

interface RuntimeInstrument {
  id: string;
  assetType: string;
  canonicalSymbol: string;
  displaySymbol: string;
  name: string;
  sector: string | null;
  category: string;
  currency: string;
}

interface RuntimePosition {
  id: string;
  portfolioId: string;
  accountId: string;
  instrumentId: string;
  symbol: RuntimeSymbol;
  quantity: number;
  averageCost: number;
  costCurrency: string;
  feesTotal: number;
  acquiredAt: string;
  riskBucket: string;
  tags: string[];
  thesis: string;
}

interface RuntimePortfolio {
  id: string;
  profileId: string;
  name: string;
  baseCurrency: string;
  benchmarkId: string;
  riskProfile: {
    maxSingleAssetWeightPct: number;
    maxCryptoWeightPct: number;
  };
  positions: RuntimePosition[];
}

interface RuntimeWatchlist {
  id: string;
  profileId: string;
  name: string;
  items: RuntimeWatchlistItem[];
}

interface RuntimeWatchlistItem {
  id: string;
  watchlistId: string;
  instrumentId: string;
  symbol: RuntimeSymbol;
  triggerNote: string;
  targetZone: Record<string, unknown>;
}

export const instrumentMap: Record<RuntimeSymbol, RuntimeInstrument> = {
  AAPL: instrument(
    fixtureIds.AAPL,
    "stock",
    "AAPL",
    "Apple Inc.",
    "Technology",
    "Mega-cap equity",
    "USD",
  ),
  NVDA: instrument(
    fixtureIds.NVDA,
    "stock",
    "NVDA",
    "NVIDIA Corporation",
    "Technology",
    "Semiconductors",
    "USD",
  ),
  BTC: instrument(
    fixtureIds.BTC,
    "crypto",
    "BTC",
    "Bitcoin",
    null,
    "Digital asset",
    "USD",
  ),
  ETH: instrument(
    fixtureIds.ETH,
    "crypto",
    "ETH",
    "Ethereum",
    null,
    "Digital asset",
    "USD",
  ),
  USDC: instrument(
    fixtureIds.USDC,
    "stablecoin",
    "USDC",
    "USD Coin",
    null,
    "Stablecoin",
    "USD",
  ),
  USD: instrument(
    fixtureIds.USD,
    "cash",
    "USD",
    "US Dollar Cash",
    null,
    "Cash",
    "USD",
  ),
  SPY: instrument(
    fixtureIds.SPY,
    "etf",
    "SPY",
    "SPDR S&P 500 ETF Trust",
    null,
    "Broad market ETF",
    "USD",
  ),
  QQQ: instrument(
    fixtureIds.QQQ,
    "etf",
    "QQQ",
    "Invesco QQQ Trust",
    null,
    "Technology-heavy ETF",
    "USD",
  ),
};

export const accounts = {
  manual: {
    id: fixtureIds.manualAccount,
    profileId: fixtureIds.profile,
    name: "Manual Holdings",
    accountType: "manual",
    baseCurrency: "USD",
  },
  cash: {
    id: fixtureIds.cashAccount,
    profileId: fixtureIds.profile,
    name: "Cash",
    accountType: "cash",
    baseCurrency: "USD",
  },
} as const;

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

function instrument(
  id: string,
  assetType: string,
  canonicalSymbol: string,
  name: string,
  sector: string | null,
  category: string,
  currency: string,
): RuntimeInstrument {
  return {
    id,
    assetType,
    canonicalSymbol,
    displaySymbol: canonicalSymbol,
    name,
    sector,
    category,
    currency,
  };
}

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

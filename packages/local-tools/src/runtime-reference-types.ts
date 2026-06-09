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

export type RuntimeSymbol =
  | "AAPL"
  | "NVDA"
  | "BTC"
  | "ETH"
  | "USDC"
  | "USD"
  | "SPY"
  | "QQQ";

export interface RuntimeInstrument {
  id: string;
  assetType: string;
  canonicalSymbol: string;
  displaySymbol: string;
  name: string;
  sector: string | null;
  category: string;
  currency: string;
}

export interface RuntimePosition {
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

export interface RuntimePortfolio {
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

export interface RuntimeWatchlist {
  id: string;
  profileId: string;
  name: string;
  items: RuntimeWatchlistItem[];
}

export interface RuntimeWatchlistItem {
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

import type { AssetType, PriceBar, QuoteSnapshot, Warning } from "@plutus/domain";

export type MarketDataKind = "quote" | "ohlcv";
export type ProviderHealthStatus =
  | "available"
  | "degraded"
  | "unavailable"
  | "rate_limited";

export type ProviderHealth = {
  provider: string;
  status: ProviderHealthStatus;
  latencyMs: number | null;
  quotaRemaining: number | null;
  checkedAt: string;
  warnings: Warning[];
};

export type ProviderInstrumentRequest = {
  instrumentId: string;
  symbol: string;
  assetType: AssetType;
  currency: string;
  providerRefs?: Record<string, string>;
  providerPreference?: string[];
};

export type OhlcvRequest = ProviderInstrumentRequest & {
  interval: string;
  start: string;
  end: string;
};

export type MarketDataProvider = {
  id: string;
  label: string;
  supportedAssetTypes: AssetType[];
  supportedData: MarketDataKind[];
  getHealth(): Promise<ProviderHealth>;
  getQuote?(request: ProviderInstrumentRequest): Promise<QuoteSnapshot>;
  getOhlcv?(request: OhlcvRequest): Promise<PriceBar[]>;
};

export type FailoverTrace = {
  selectedProvider: string;
  attemptedProviders: string[];
  warnings: Warning[];
};

export type QuoteResult = {
  quote: QuoteSnapshot;
  health: ProviderHealth;
  failover: FailoverTrace;
};

export type OhlcvResult = {
  candles: PriceBar[];
  health: ProviderHealth;
  failover: FailoverTrace;
};

export type MarketDataServiceOptions = {
  providers: MarketDataProvider[];
  failover?: {
    acceptStale?: boolean;
  };
};

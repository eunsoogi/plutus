import {
  type AssetType,
  type PriceBar,
  PriceBarSchema,
  type QuoteSnapshot,
  QuoteSnapshotSchema,
  type Warning,
  WarningSchema,
} from "@plutus/domain";

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

export class MarketDataUnavailableError extends Error {
  readonly code = "market_data_unavailable";
  readonly warnings: Warning[];

  constructor(message: string, warnings: Warning[]) {
    super(message);
    this.name = "MarketDataUnavailableError";
    this.warnings = warnings;
  }
}

export function resolveProviderSymbol(
  request: ProviderInstrumentRequest,
  providerId: string,
): string {
  return request.providerRefs?.[providerId] ?? request.symbol;
}

export function makeProviderWarning(
  code: string,
  severity: Warning["severity"],
  message: string,
): Warning {
  return WarningSchema.parse({ code, severity, message });
}

function supportsRequest(
  provider: MarketDataProvider,
  request: ProviderInstrumentRequest,
  dataKind: MarketDataKind,
): Warning | null {
  if (!provider.supportedData.includes(dataKind)) {
    return makeProviderWarning(
      "provider_unsupported_data_kind",
      "warning",
      `${provider.id} does not support ${dataKind}.`,
    );
  }

  if (!provider.supportedAssetTypes.includes(request.assetType)) {
    return makeProviderWarning(
      "provider_unsupported_asset_type",
      "warning",
      `${provider.id} does not support ${request.assetType}.`,
    );
  }

  return null;
}

function orderProviders(
  providers: MarketDataProvider[],
  preference?: string[],
): MarketDataProvider[] {
  if (!preference || preference.length === 0) {
    return providers;
  }

  const byId = new Map(providers.map((provider) => [provider.id, provider]));
  const preferred = preference.flatMap((id) => {
    const provider = byId.get(id);
    return provider ? [provider] : [];
  });
  const remaining = providers.filter(
    (provider) => !preference.includes(provider.id),
  );
  return [...preferred, ...remaining];
}

function healthWarning(health: ProviderHealth): Warning | null {
  if (health.status === "available" || health.status === "degraded") {
    return null;
  }

  return makeProviderWarning(
    health.status === "rate_limited"
      ? "provider_rate_limited"
      : "provider_unavailable",
    "warning",
    `${health.provider} is ${health.status}.`,
  );
}

function isUsableHealth(health: ProviderHealth): boolean {
  return health.status === "available" || health.status === "degraded";
}

function assertQuoteFields(quote: QuoteSnapshot): Warning | null {
  if (quote.price <= 0 || quote.currency.length !== 3) {
    return makeProviderWarning(
      "provider_missing_required_fields",
      "warning",
      `${quote.provider} returned missing quote fields.`,
    );
  }

  return null;
}

async function readProviderHealth(
  provider: MarketDataProvider,
): Promise<ProviderHealth> {
  try {
    return await provider.getHealth();
  } catch (error) {
    return {
      provider: provider.id,
      status: "unavailable",
      latencyMs: null,
      quotaRemaining: null,
      checkedAt: new Date(0).toISOString(),
      warnings: [
        makeProviderWarning(
          "provider_health_failed",
          "warning",
          `${provider.id} health check failed: ${
            error instanceof Error ? error.message : "unknown error"
          }`,
        ),
      ],
    };
  }
}

function buildFailure(warnings: Warning[]): MarketDataUnavailableError {
  return new MarketDataUnavailableError(
    "No free market-data provider satisfied the request.",
    [
      ...warnings,
      makeProviderWarning(
        "market_data_unavailable",
        "blocking",
        "No free market-data provider could satisfy the request.",
      ),
    ],
  );
}

export function createMarketDataService(options: MarketDataServiceOptions) {
  const acceptStale = options.failover?.acceptStale ?? false;

  async function getProviderHealth(): Promise<ProviderHealth[]> {
    return Promise.all(
      options.providers.map((provider) => provider.getHealth()),
    );
  }

  async function getQuote(
    request: ProviderInstrumentRequest,
  ): Promise<QuoteResult> {
    const attemptedProviders: string[] = [];
    const warnings: Warning[] = [];

    for (const provider of orderProviders(
      options.providers,
      request.providerPreference,
    )) {
      attemptedProviders.push(provider.id);
      const supportWarning = supportsRequest(provider, request, "quote");
      if (supportWarning) {
        warnings.push(supportWarning);
        continue;
      }

      const health = await readProviderHealth(provider);
      warnings.push(...health.warnings);
      const blockedByHealth = healthWarning(health);
      if (blockedByHealth) {
        warnings.push(blockedByHealth);
      }
      if (!isUsableHealth(health) || !provider.getQuote) {
        continue;
      }

      let quote: QuoteSnapshot;
      try {
        quote = QuoteSnapshotSchema.parse(await provider.getQuote(request));
      } catch (error) {
        warnings.push(
          makeProviderWarning(
            "provider_request_failed",
            "warning",
            `${provider.id} quote request failed: ${
              error instanceof Error ? error.message : "unknown error"
            }`,
          ),
        );
        continue;
      }

      const missingFieldsWarning = assertQuoteFields(quote);
      if (missingFieldsWarning) {
        warnings.push(missingFieldsWarning);
        continue;
      }

      if (quote.freshness.delayStatus === "stale" && !acceptStale) {
        warnings.push(...quote.freshness.warnings);
        continue;
      }

      return {
        quote,
        health,
        failover: {
          selectedProvider: provider.id,
          attemptedProviders,
          warnings,
        },
      };
    }

    throw buildFailure(warnings);
  }

  async function getOhlcv(request: OhlcvRequest): Promise<OhlcvResult> {
    const attemptedProviders: string[] = [];
    const warnings: Warning[] = [];

    for (const provider of orderProviders(
      options.providers,
      request.providerPreference,
    )) {
      attemptedProviders.push(provider.id);
      const supportWarning = supportsRequest(provider, request, "ohlcv");
      if (supportWarning) {
        warnings.push(supportWarning);
        continue;
      }

      const health = await readProviderHealth(provider);
      warnings.push(...health.warnings);
      const blockedByHealth = healthWarning(health);
      if (blockedByHealth) {
        warnings.push(blockedByHealth);
      }
      if (!isUsableHealth(health) || !provider.getOhlcv) {
        continue;
      }

      let candles: PriceBar[];
      try {
        candles = (await provider.getOhlcv(request)).map((candle) =>
          PriceBarSchema.parse(candle),
        );
      } catch (error) {
        warnings.push(
          makeProviderWarning(
            "provider_request_failed",
            "warning",
            `${provider.id} OHLCV request failed: ${
              error instanceof Error ? error.message : "unknown error"
            }`,
          ),
        );
        continue;
      }

      if (candles.length === 0) {
        warnings.push(
          makeProviderWarning(
            "provider_missing_required_fields",
            "warning",
            `${provider.id} returned no candles.`,
          ),
        );
        continue;
      }

      return {
        candles,
        health,
        failover: {
          selectedProvider: provider.id,
          attemptedProviders,
          warnings,
        },
      };
    }

    throw buildFailure(warnings);
  }

  return {
    getProviderHealth,
    getQuote,
    getOhlcv,
  };
}

import {
  type PriceBar,
  PriceBarSchema,
  type QuoteSnapshot,
  QuoteSnapshotSchema,
  type Warning,
} from "@plutus/domain";
import type {
  MarketDataServiceOptions,
  OhlcvRequest,
  OhlcvResult,
  ProviderHealth,
  ProviderInstrumentRequest,
  QuoteResult,
} from "./provider-types";
import {
  assertQuoteFields,
  buildFailure,
  healthWarning,
  isUsableHealth,
  makeProviderWarning,
  orderProviders,
  readProviderHealth,
  supportsRequest,
} from "./provider-support";

export * from "./provider-errors";
export * from "./provider-support";
export * from "./provider-types";

export function createMarketDataService(options: MarketDataServiceOptions) {
  const acceptStale = options.failover?.acceptStale ?? false;

  async function getProviderHealth(): Promise<ProviderHealth[]> {
    return Promise.all(options.providers.map(readProviderHealth));
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

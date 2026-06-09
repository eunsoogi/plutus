import { type QuoteSnapshot, WarningSchema, type Warning } from "@plutus/domain";
import type {
  MarketDataKind,
  MarketDataProvider,
  ProviderHealth,
  ProviderInstrumentRequest,
} from "./provider-types";
import { MarketDataUnavailableError } from "./provider-errors";

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

export function supportsRequest(
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

export function orderProviders(
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

export function healthWarning(health: ProviderHealth): Warning | null {
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

export function isUsableHealth(health: ProviderHealth): boolean {
  return health.status === "available" || health.status === "degraded";
}

export function assertQuoteFields(quote: QuoteSnapshot): Warning | null {
  if (quote.price <= 0 || quote.currency.length !== 3) {
    return makeProviderWarning(
      "provider_missing_required_fields",
      "warning",
      `${quote.provider} returned missing quote fields.`,
    );
  }

  return null;
}

export async function readProviderHealth(
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

export function buildFailure(warnings: Warning[]): MarketDataUnavailableError {
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

import { createMarketDataService, type OhlcvRequest } from "@plutus/data";
import { warning } from "./common";
import {
  allowFixtureMarketData,
  instrumentCatalog,
} from "./market-data-catalog";
import { requestFor, symbolFor } from "./market-data-quotes";

export async function getOhlcv(
  input: unknown,
  service: ReturnType<typeof createMarketDataService>,
) {
  const base = requestFor(input);
  const request: OhlcvRequest = {
    ...base,
    interval:
      input && typeof input === "object" && "interval" in input
        ? String((input as { interval: unknown }).interval)
        : "1d",
    start:
      input && typeof input === "object" && "start" in input
        ? String((input as { start: unknown }).start)
        : "2026-05-15T00:00:00.000Z",
    end:
      input && typeof input === "object" && "end" in input
        ? String((input as { end: unknown }).end)
        : "2026-05-17T00:00:00.000Z",
  };
  if (!allowFixtureMarketData()) {
    return {
      syntheticBlocked: true as const,
      symbol: request.symbol,
      candles: [],
      freshness: freshnessMetadata(providerFor(request.symbol), "unknown"),
    };
  }
  if (!["NVDA", "BTC"].includes(request.symbol)) {
    return {
      syntheticBlocked: true as const,
      symbol: request.symbol,
      candles: [],
      freshness: freshnessMetadata("fixture", "unknown"),
    };
  }
  return {
    syntheticBlocked: false as const,
    symbol: request.symbol,
    candles: (await service.getOhlcv(request)).candles,
    freshness: freshnessMetadata(providerFor(request.symbol), "delayed"),
  };
}

export function unsupportedSymbolWarning(input: unknown) {
  const symbol = symbolFor(input);
  if (
    !symbol &&
    input &&
    typeof input === "object" &&
    "instrumentId" in input
  ) {
    return warning(
      "unsupported_symbol",
      "blocking",
      `Instrument ${(input as { instrumentId: unknown }).instrumentId} is not in the deterministic MVP market catalog.`,
    );
  }
  if (!symbol || instrumentCatalog[symbol]) {
    return undefined;
  }
  return warning(
    "unsupported_symbol",
    "blocking",
    `Symbol ${symbol} is not in the deterministic MVP market catalog.`,
  );
}

export function searchInstruments(input: unknown) {
  const query =
    input && typeof input === "object" && "query" in input
      ? String((input as { query: unknown }).query)
          .toLowerCase()
          .trim()
      : "";
  const assetTypes =
    input && typeof input === "object" && "assetTypes" in input
      ? new Set((input as { assetTypes?: string[] }).assetTypes ?? [])
      : undefined;
  const regions =
    input && typeof input === "object" && "regions" in input
      ? new Set(
          ((input as { regions?: string[] }).regions ?? []).map((region) =>
            region.toLowerCase(),
          ),
        )
      : undefined;

  return Object.entries(instrumentCatalog)
    .filter(([symbol, instrument]) => {
      const matchesQuery =
        !query ||
        symbol.toLowerCase().includes(query) ||
        instrument.displayName.toLowerCase().includes(query);
      const matchesAssetType =
        !assetTypes?.size || assetTypes.has(instrument.assetType);
      const matchesRegion =
        !regions?.size || regions.has(instrument.region.toLowerCase());
      return matchesQuery && matchesAssetType && matchesRegion;
    })
    .map(([symbol, instrument]) => ({
      symbol,
      instrumentId: instrument.instrumentId,
      assetType: instrument.assetType,
      region: instrument.region,
      displayName: instrument.displayName,
      providerRefs: instrument.providerRefs ?? {},
      sourceRef: {
        id:
          instrument.providerRefs?.["yahoo-compatible"] ??
          instrument.providerRefs?.coingecko ??
          symbol,
        provider: allowFixtureMarketData() ? "fixture" : "local_catalog",
        asOf: new Date().toISOString(),
        retrievedAt: new Date().toISOString(),
      },
      freshness: freshnessMetadata(
        allowFixtureMarketData() ? "fixture" : "local_catalog",
        allowFixtureMarketData() ? "delayed" : "unknown",
      ),
    }));
}

export function freshnessMetadata(provider: string, delayStatus: string) {
  return {
    provider,
    asOf: "2026-05-17T00:00:00.000Z",
    retrievedAt: new Date(0).toISOString(),
    delayStatus,
    warnings:
      delayStatus === "stale"
        ? [
            {
              code: "provider_stale",
              severity: "warning",
              message: `${provider} data is stale.`,
            },
          ]
        : [],
  };
}

export function providerFor(symbol: string): string {
  if (symbol === "BTC") return "coingecko";
  if (symbol === "NVDA") return "yahoo-compatible";
  return "not_configured";
}

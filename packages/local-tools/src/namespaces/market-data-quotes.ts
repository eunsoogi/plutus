import type { ProviderInstrumentRequest } from "@plutus/data";
import { warning } from "./common";
import { instrumentCatalog, marketDataService } from "./market-data-catalog";

export async function getQuoteWithProviderWarning(
  service: ReturnType<typeof marketDataService>,
  input: unknown,
) {
  try {
    return await service.getQuote(requestFor(input));
  } catch (error) {
    const warnings =
      error && typeof error === "object" && "warnings" in error
        ? (error as { warnings?: unknown }).warnings
        : undefined;
    if (Array.isArray(warnings)) {
      return {
        quote: null,
        failover: {
          selectedProvider: "none",
          attemptedProviders: attemptedProvidersFromWarnings(warnings),
          warnings,
        },
      };
    }
    return undefined;
  }
}

export function attemptedProvidersFromWarnings(warnings: unknown[]) {
  const providers = warnings
    .map((item) =>
      item && typeof item === "object" && "message" in item
        ? String((item as { message: unknown }).message).split(" ")[0]
        : undefined,
    )
    .filter((value): value is string =>
      Boolean(
        value &&
        ["yahoo-compatible", "coingecko", "ccxt-fixture"].includes(value),
      ),
    );
  return [...new Set(providers)];
}

export function providerUnavailableWarning(purpose: string) {
  return warning(
    "market_data_provider_unavailable",
    "blocking",
    `No configured market data provider returned a ${purpose} response for the requested instrument.`,
  );
}

export function requestFor(input: unknown): ProviderInstrumentRequest {
  const symbol =
    input && typeof input === "object" && "symbol" in input
      ? String((input as { symbol: unknown }).symbol).toUpperCase()
      : input && typeof input === "object" && "instrumentId" in input
        ? (instrumentById(
            String((input as { instrumentId: unknown }).instrumentId),
          ) ?? "NVDA")
        : "NVDA";
  const request = instrumentCatalog[symbol] ?? instrumentCatalog.NVDA;
  return {
    ...request,
    providerPreference:
      input && typeof input === "object" && "providerPreference" in input
        ? (input as { providerPreference?: string[] }).providerPreference
        : undefined,
  };
}

export function hasProviderPreference(input: unknown) {
  if (!input || typeof input !== "object") return false;
  return (
    "providerPreference" in input &&
    Array.isArray(
      (input as { providerPreference?: unknown }).providerPreference,
    )
  );
}

export function quoteWarnings(fixture: {
  warnings?: Array<
    string | { message: string; severity?: "info" | "warning" | "blocking" }
  >;
  freshness?: { delayStatus?: string };
  delayStatus?: string;
}) {
  const warnings = fixture.warnings ?? [];
  const freshness = fixture.freshness?.delayStatus ?? fixture.delayStatus;
  return [
    ...warnings.map((item) =>
      typeof item === "string"
        ? warning("provider_freshness_warning", "warning", item)
        : warning(
            "provider_freshness_warning",
            item.severity ?? "warning",
            item.message,
          ),
    ),
    ...(freshness && freshness !== "real_time"
      ? [
          warning(
            "provider_freshness_warning",
            freshness === "stale" ? "blocking" : "warning",
            `Quote freshness is ${freshness}.`,
          ),
        ]
      : []),
  ];
}

export function instrumentById(instrumentId: string): string | undefined {
  return Object.entries(instrumentCatalog).find(
    ([, instrument]) => instrument.instrumentId === instrumentId,
  )?.[0];
}

export function symbolFor(input: unknown): string | undefined {
  if (!input || typeof input !== "object") {
    return undefined;
  }
  if ("symbol" in input) {
    return String((input as { symbol: unknown }).symbol).toUpperCase();
  }
  if ("instrumentId" in input) {
    return instrumentById(
      String((input as { instrumentId: unknown }).instrumentId),
    );
  }
  return undefined;
}

export function fixtureQuoteFor(input: unknown) {
  const symbol = symbolFor(input);
  if (!symbol) {
    return undefined;
  }
  const instrument = instrumentCatalog[symbol];
  if (!instrument) {
    return undefined;
  }
  const price: Record<string, number> = {
    BTC: 67120,
    ETH: 3900,
    NVDA: 118.75,
    AAPL: 212.5,
    USDC: 1,
    USD: 1,
    SPY: 525.12,
    QQQ: 452.4,
  };
  return {
    id: `018f3f5d-0000-7000-8000-0000000003${String(
      Object.keys(instrumentCatalog).indexOf(symbol),
    ).padStart(2, "0")}`,
    instrumentId: instrument.instrumentId,
    provider: symbol === "BTC" ? "coingecko" : "fixture",
    asOf: "2026-05-17T00:00:00.000Z",
    price: price[symbol] ?? 1,
    currency: "USD",
    bid: null,
    ask: null,
    volume: null,
    delayStatus: symbol === "USD" ? "realtime" : "delayed",
    warnings: [],
  };
}

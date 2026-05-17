import {
  createCcxtFixtureProvider,
  createCoinGeckoProvider,
  createMarketDataService,
  createYahooCompatibleProvider,
  type OhlcvRequest,
  type ProviderInstrumentRequest,
} from "@plutus/data";
import { fixtureIds } from "@plutus/test-fixtures";

import type { NamespaceHandler } from "./common";
import { ok } from "./common";

const instrumentCatalog: Record<
  string,
  ProviderInstrumentRequest & { displayName: string }
> = {
  NVDA: {
    instrumentId: fixtureIds.NVDA,
    symbol: "NVDA",
    assetType: "stock",
    currency: "USD",
    providerRefs: { "yahoo-compatible": "NVDA" },
    displayName: "NVIDIA Corporation",
  },
  BTC: {
    instrumentId: fixtureIds.BTC,
    symbol: "BTC",
    assetType: "crypto",
    currency: "USD",
    providerRefs: { coingecko: "bitcoin", "ccxt-fixture": "BTC/USD" },
    displayName: "Bitcoin",
  },
};

const service = createMarketDataService({
  providers: [
    createYahooCompatibleProvider(),
    createCoinGeckoProvider(),
    createCcxtFixtureProvider(),
  ],
});

export const handleMarketData: NamespaceHandler = async ({
  call,
  auditRef,
}) => {
  switch (call.tool) {
    case "search_instruments":
      return ok(
        auditRef,
        "plutus_market_data",
        Object.entries(instrumentCatalog).map(([symbol, instrument]) => ({
          symbol,
          instrumentId: instrument.instrumentId,
          assetType: instrument.assetType,
          displayName: instrument.displayName,
          providerRefs: instrument.providerRefs,
        })),
      );
    case "get_provider_health":
      return ok(auditRef, "plutus_market_data", {
        providerHealth: await service.getProviderHealth(),
      });
    case "select_provider": {
      const quote = await service.getQuote(requestFor(call.input));
      return ok(auditRef, "plutus_market_data", {
        selectedProvider: quote.failover.selectedProvider,
        attemptedProviders: quote.failover.attemptedProviders,
        warnings: quote.failover.warnings,
      });
    }
    case "get_quote":
      return ok(auditRef, "plutus_market_data", {
        quote: (await service.getQuote(requestFor(call.input))).quote,
      });
    case "get_ohlcv":
    case "get_benchmark_series":
      return ok(auditRef, "plutus_market_data", {
        candles: await getOhlcv(call.input),
      });
    case "get_corporate_actions":
      return ok(auditRef, "plutus_market_data", {
        actions: [],
        warnings: [
          {
            code: "provider_not_available_for_fixture",
            severity: "info",
            message:
              "No corporate actions are present in deterministic MVP fixtures.",
          },
        ],
      });
    case "get_market_status":
      return ok(auditRef, "plutus_market_data", {
        status: "open_or_delayed",
        provider: "fixture",
        asOf: new Date(0).toISOString(),
      });
    default:
      return ok(auditRef, "plutus_market_data", {
        tool: call.tool,
        status: "unsupported_market_data_tool",
      });
  }
};

function requestFor(input: unknown): ProviderInstrumentRequest {
  const symbol =
    input && typeof input === "object" && "symbol" in input
      ? String((input as { symbol: unknown }).symbol).toUpperCase()
      : input && typeof input === "object" && "instrumentId" in input
        ? instrumentById(
            String((input as { instrumentId: unknown }).instrumentId),
          )
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

function instrumentById(instrumentId: string): string {
  return (
    Object.entries(instrumentCatalog).find(
      ([, instrument]) => instrument.instrumentId === instrumentId,
    )?.[0] ?? "NVDA"
  );
}

async function getOhlcv(input: unknown) {
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
  return (await service.getOhlcv(request)).candles;
}

import {
  createCcxtFixtureProvider,
  createCoinGeckoProvider,
  createMarketDataService,
  createYahooCompatibleProvider,
  type OhlcvRequest,
  type ProviderInstrumentRequest,
} from "@plutus/data";
import { fixtureIds, instrumentMap, marketData } from "@plutus/test-fixtures";

import type { NamespaceHandler } from "./common";
import { ok, warning } from "./common";

const instrumentCatalog: Record<
  string,
  ProviderInstrumentRequest & { displayName: string; region: string }
> = {
  AAPL: {
    instrumentId: fixtureIds.AAPL,
    symbol: "AAPL",
    assetType: "stock",
    currency: "USD",
    providerRefs: { fixture: "AAPL", "yahoo-compatible": "AAPL" },
    displayName: "Apple Inc.",
    region: "US",
  },
  NVDA: {
    instrumentId: fixtureIds.NVDA,
    symbol: "NVDA",
    assetType: "stock",
    currency: "USD",
    providerRefs: { "yahoo-compatible": "NVDA" },
    displayName: "NVIDIA Corporation",
    region: "US",
  },
  BTC: {
    instrumentId: fixtureIds.BTC,
    symbol: "BTC",
    assetType: "crypto",
    currency: "USD",
    providerRefs: { coingecko: "bitcoin", "ccxt-fixture": "BTC/USD" },
    displayName: "Bitcoin",
    region: "global",
  },
  ETH: {
    instrumentId: fixtureIds.ETH,
    symbol: "ETH",
    assetType: "crypto",
    currency: "USD",
    providerRefs: { fixture: "ETH-USD", coingecko: "ethereum" },
    displayName: "Ethereum",
    region: "global",
  },
  USDC: {
    instrumentId: fixtureIds.USDC,
    symbol: "USDC",
    assetType: "stablecoin",
    currency: "USD",
    providerRefs: { fixture: "USDC-USD" },
    displayName: "USD Coin",
    region: "global",
  },
  USD: {
    instrumentId: fixtureIds.USD,
    symbol: "USD",
    assetType: "cash",
    currency: "USD",
    providerRefs: { fixture: "USD-CASH" },
    displayName: "US Dollar Cash",
    region: "US",
  },
  SPY: {
    instrumentId: fixtureIds.SPY,
    symbol: "SPY",
    assetType: "etf",
    currency: "USD",
    providerRefs: { fixture: "SPY", "yahoo-compatible": "SPY" },
    displayName: "SPDR S&P 500 ETF Trust",
    region: "US",
  },
  QQQ: {
    instrumentId: fixtureIds.QQQ,
    symbol: "QQQ",
    assetType: "etf",
    currency: "USD",
    providerRefs: { fixture: "QQQ", "yahoo-compatible": "QQQ" },
    displayName: "Invesco QQQ Trust",
    region: "US",
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
  const unsupported = unsupportedSymbolWarning(call.input);
  if (unsupported) {
    return ok(auditRef, "plutus_market_data", undefined, [unsupported]);
  }

  switch (call.tool) {
    case "search_instruments":
      return ok(auditRef, "plutus_market_data", {
        instruments: searchInstruments(call.input),
        freshness: freshnessMetadata("fixture", "delayed"),
      });
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
    case "get_quote": {
      const fixture = fixtureQuoteFor(call.input);
      if (fixture) {
        return ok(
          auditRef,
          "plutus_market_data",
          { quote: fixture },
          quoteWarnings(fixture),
        );
      }
      return ok(auditRef, "plutus_market_data", {
        quote: (await service.getQuote(requestFor(call.input))).quote,
      });
    }
    case "get_ohlcv":
    case "get_benchmark_series":
      return getOhlcv(call.input).then((result) =>
        result.syntheticBlocked
          ? ok(auditRef, "plutus_market_data", undefined, [
              warning(
                "synthetic_market_data_blocked",
                "blocking",
                `${result.symbol} OHLCV would require synthetic fixture data; synthetic market data is blocked for this tool.`,
              ),
            ])
          : ok(auditRef, "plutus_market_data", {
              candles: result.candles,
              freshness: result.freshness,
            }),
      );
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

function quoteWarnings(fixture: {
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

function instrumentById(instrumentId: string): string | undefined {
  return Object.entries(instrumentCatalog).find(
    ([, instrument]) => instrument.instrumentId === instrumentId,
  )?.[0];
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

function searchInstruments(input: unknown) {
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
        id: instrument.providerRefs?.fixture ?? symbol,
        provider: "fixture",
        asOf: "2026-05-17T00:00:00.000Z",
        retrievedAt: new Date(0).toISOString(),
      },
      freshness: freshnessMetadata("fixture", "delayed"),
    }));
}

function freshnessMetadata(provider: string, delayStatus: string) {
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

function providerFor(symbol: string): string {
  if (symbol === "BTC") return "coingecko";
  if (symbol === "NVDA") return "yahoo-compatible";
  return "fixture";
}

function unsupportedSymbolWarning(input: unknown) {
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

function symbolFor(input: unknown): string | undefined {
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

function fixtureQuoteFor(input: unknown) {
  const symbol = symbolFor(input);
  if (!symbol || ["NVDA", "BTC"].includes(symbol)) {
    return undefined;
  }
  const instrument = instrumentMap[symbol as keyof typeof instrumentMap];
  if (!instrument) {
    return undefined;
  }
  const existing = marketData.quotes.find(
    (quote) => quote.instrumentId === instrument.id,
  );
  if (existing) {
    return existing;
  }
  const price: Record<string, number> = {
    AAPL: 212.5,
    USDC: 1,
    USD: 1,
    SPY: 525.12,
    QQQ: 452.4,
  };
  return {
    id: `fixture_quote_${symbol.toLowerCase()}`,
    instrumentId: instrument.id,
    provider: "fixture",
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

import {
  createCcxtFixtureProvider,
  createCoinGeckoProvider,
  createMarketDataService,
  createYahooCompatibleProvider,
  type OhlcvRequest,
  type ProviderInstrumentRequest,
} from "@plutus/data";

import type { NamespaceHandler } from "./common";
import { allowFixtureTools, ok, warning } from "./common";

const instrumentIds = {
  AAPL: "018f3f5d-0000-7000-8000-000000000101",
  NVDA: "018f3f5d-0000-7000-8000-000000000102",
  BTC: "018f3f5d-0000-7000-8000-000000000103",
  ETH: "018f3f5d-0000-7000-8000-000000000104",
  USDC: "018f3f5d-0000-7000-8000-000000000105",
  USD: "018f3f5d-0000-7000-8000-000000000106",
  SPY: "018f3f5d-0000-7000-8000-000000000107",
  QQQ: "018f3f5d-0000-7000-8000-000000000108",
} as const;

const instrumentCatalog: Record<
  string,
  ProviderInstrumentRequest & { displayName: string; region: string }
> = {
  AAPL: {
    instrumentId: instrumentIds.AAPL,
    symbol: "AAPL",
    assetType: "stock",
    currency: "USD",
    providerRefs: { fixture: "AAPL", "yahoo-compatible": "AAPL" },
    displayName: "Apple Inc.",
    region: "US",
  },
  NVDA: {
    instrumentId: instrumentIds.NVDA,
    symbol: "NVDA",
    assetType: "stock",
    currency: "USD",
    providerRefs: { "yahoo-compatible": "NVDA" },
    displayName: "NVIDIA Corporation",
    region: "US",
  },
  BTC: {
    instrumentId: instrumentIds.BTC,
    symbol: "BTC",
    assetType: "crypto",
    currency: "USD",
    providerRefs: { coingecko: "bitcoin", "ccxt-fixture": "BTC/USD" },
    displayName: "Bitcoin",
    region: "global",
  },
  ETH: {
    instrumentId: instrumentIds.ETH,
    symbol: "ETH",
    assetType: "crypto",
    currency: "USD",
    providerRefs: { fixture: "ETH-USD", coingecko: "ethereum" },
    displayName: "Ethereum",
    region: "global",
  },
  USDC: {
    instrumentId: instrumentIds.USDC,
    symbol: "USDC",
    assetType: "stablecoin",
    currency: "USD",
    providerRefs: { fixture: "USDC-USD" },
    displayName: "USD Coin",
    region: "global",
  },
  USD: {
    instrumentId: instrumentIds.USD,
    symbol: "USD",
    assetType: "cash",
    currency: "USD",
    providerRefs: { fixture: "USD-CASH" },
    displayName: "US Dollar Cash",
    region: "US",
  },
  SPY: {
    instrumentId: instrumentIds.SPY,
    symbol: "SPY",
    assetType: "etf",
    currency: "USD",
    providerRefs: { fixture: "SPY", "yahoo-compatible": "SPY" },
    displayName: "SPDR S&P 500 ETF Trust",
    region: "US",
  },
  QQQ: {
    instrumentId: instrumentIds.QQQ,
    symbol: "QQQ",
    assetType: "etf",
    currency: "USD",
    providerRefs: { fixture: "QQQ", "yahoo-compatible": "QQQ" },
    displayName: "Invesco QQQ Trust",
    region: "US",
  },
};

function marketDataService() {
  if (allowFixtureMarketData()) {
    return createMarketDataService({
      providers: [
        createYahooCompatibleProvider(),
        createCoinGeckoProvider(),
        createCcxtFixtureProvider(),
      ],
      failover: { acceptStale: true },
    });
  }
  const providers = [
    createYahooCompatibleProvider({
      useNetwork: true,
      fetch: globalThis.fetch,
    }),
    createCoinGeckoProvider({
      client: {
        async getMarket(symbols, currency) {
          const url = new URL("https://api.coingecko.com/api/v3/coins/markets");
          url.searchParams.set("vs_currency", currency.toLowerCase());
          url.searchParams.set("ids", symbols.join(","));
          const response = await fetch(url);
          if (!response.ok) return [];
          return (await response.json()) as any[];
        },
      },
    }),
  ];
  return createMarketDataService({ providers });
}

function allowFixtureMarketData() {
  return allowFixtureTools();
}

export const handleMarketData: NamespaceHandler = async ({
  call,
  auditRef,
}) => {
  const service = marketDataService();
  const unsupported = unsupportedSymbolWarning(call.input);
  if (unsupported) {
    return ok(auditRef, "plutus_market_data", undefined, [unsupported]);
  }

  switch (call.tool) {
    case "search_instruments":
      return ok(auditRef, "plutus_market_data", {
        instruments: searchInstruments(call.input),
        freshness: freshnessMetadata(
          allowFixtureMarketData() ? "fixture" : "local_catalog",
          allowFixtureMarketData() ? "delayed" : "unknown",
        ),
      });
    case "get_provider_health":
      return ok(
        auditRef,
        "plutus_market_data",
        {
          providerHealth: await service.getProviderHealth(),
        },
        allowFixtureMarketData()
          ? []
          : [
              warning(
                "provider_health_requires_live_probe",
                "warning",
                "Provider health is adapter-level; quote requests still surface attempted providers and failover reasons.",
              ),
            ],
      );
    case "select_provider": {
      const quote = await getQuoteWithProviderWarning(service, call.input);
      if (!quote) {
        return ok(auditRef, "plutus_market_data", undefined, [
          providerUnavailableWarning("select provider"),
        ]);
      }
      return ok(auditRef, "plutus_market_data", {
        selectedProvider: quote.failover.selectedProvider,
        attemptedProviders: quote.failover.attemptedProviders,
        warnings: quote.failover.warnings,
      });
    }
    case "get_quote": {
      const fixture =
        allowFixtureMarketData() && !hasProviderPreference(call.input)
          ? fixtureQuoteFor(call.input)
          : undefined;
      if (fixture) {
        const warnings = quoteWarnings(fixture);
        const selectedProvider = fixture.provider ?? "fixture";
        return ok(
          auditRef,
          "plutus_market_data",
          {
            quote: fixture,
            failover: {
              selectedProvider,
              attemptedProviders: [selectedProvider],
              warnings,
            },
          },
          warnings,
        );
      }
      const quote = await getQuoteWithProviderWarning(service, call.input);
      if (!quote || quote.quote === null) {
        return ok(auditRef, "plutus_market_data", { quote: null }, [
          providerUnavailableWarning("quote"),
          ...(quote?.failover.warnings.map((item) =>
            warning(
              item.code,
              item.severity,
              item.message,
              "evidenceRefs" in item && Array.isArray(item.evidenceRefs)
                ? item.evidenceRefs.map(String)
                : [],
            ),
          ) ?? []),
        ]);
      }
      return ok(
        auditRef,
        "plutus_market_data",
        {
          quote: quote.quote,
          failover: quote.failover,
        },
        quote.failover.warnings.map((item) =>
          warning(
            item.code,
            item.severity,
            item.message,
            "evidenceRefs" in item && Array.isArray(item.evidenceRefs)
              ? item.evidenceRefs.map(String)
              : [],
          ),
        ),
      );
    }
    case "get_ohlcv":
    case "get_benchmark_series":
      return getOhlcv(call.input, service).then((result) =>
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
      return ok(
        auditRef,
        "plutus_market_data",
        {
          actions: [],
        },
        [
          warning(
            "provider_not_available",
            "blocking",
            "Corporate actions provider is not configured for local runtime.",
          ),
        ],
      );
    case "get_market_status":
      return ok(
        auditRef,
        "plutus_market_data",
        {
          status: "unknown",
          provider: "not_configured",
          asOf: new Date().toISOString(),
        },
        [
          warning(
            "provider_not_available",
            "blocking",
            "Market status provider is not configured for local runtime.",
          ),
        ],
      );
    default:
      return ok(auditRef, "plutus_market_data", {
        tool: call.tool,
        status: "unsupported_market_data_tool",
      });
  }
};

async function getQuoteWithProviderWarning(
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

function attemptedProvidersFromWarnings(warnings: unknown[]) {
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

function providerUnavailableWarning(purpose: string) {
  return warning(
    "market_data_provider_unavailable",
    "blocking",
    `No configured market data provider returned a ${purpose} response for the requested instrument.`,
  );
}

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

function hasProviderPreference(input: unknown) {
  if (!input || typeof input !== "object") return false;
  return (
    "providerPreference" in input &&
    Array.isArray(
      (input as { providerPreference?: unknown }).providerPreference,
    )
  );
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

async function getOhlcv(
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
  return "not_configured";
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

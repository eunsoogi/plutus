import type { NamespaceHandler } from "./common";
import { ok, warning } from "./common";
import {
  allowFixtureMarketData,
  marketDataService,
} from "./market-data-catalog";
import {
  fixtureQuoteFor,
  getQuoteWithProviderWarning,
  hasProviderPreference,
  providerUnavailableWarning,
  quoteWarnings,
} from "./market-data-quotes";
import {
  freshnessMetadata,
  getOhlcv,
  searchInstruments,
  unsupportedSymbolWarning,
} from "./market-data-series";

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

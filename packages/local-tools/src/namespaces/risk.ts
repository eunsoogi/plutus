import {
  corePortfolio,
  fixtureIds,
  instrumentMap,
} from "../runtime-reference-data";

import type { NamespaceHandler } from "./common";
import { allowFixtureTools, ok, warning, writeDurableJson } from "./common";
import type {
  LocalToolResponse,
  LocalToolWarning,
  SourceRef,
} from "../schemas/envelope";

const CURRENT_PRICES: Record<string, number> = {
  AAPL: 212.5,
  NVDA: 924.79,
  BTC: 67120,
  ETH: 3220,
  USDC: 1,
  USD: 1,
};

const RISK_SOURCE_REFS = {
  returns: source("risk_fixture_return_series", "BTC/NVDA fixture returns"),
  portfolio: source("risk_fixture_portfolio_core", "Core portfolio fixture"),
  liquidity: source("risk_fixture_liquidity", "Liquidity depth fixture"),
  scenario: source("risk_fixture_scenarios", "MVP stress scenario fixture"),
} as const;

const VOLATILITY_FIXTURES: Record<
  string,
  {
    realizedVolatilityPct: number;
    rolling30DayPct: number;
    latestDailyMovePct: number;
  }
> = {
  BTC: {
    realizedVolatilityPct: 58.4,
    rolling30DayPct: 62.1,
    latestDailyMovePct: -3.8,
  },
  NVDA: {
    realizedVolatilityPct: 37.2,
    rolling30DayPct: 34.8,
    latestDailyMovePct: 2.1,
  },
  CORE: {
    realizedVolatilityPct: 31.6,
    rolling30DayPct: 33.4,
    latestDailyMovePct: -1.7,
  },
};

const DRAWDOWN_FIXTURE = {
  seriesRef: "fixture:portfolio-core",
  maxDrawdownPct: -18.7,
  peakDate: "2026-03-14",
  troughDate: "2026-04-19",
  recoveredAt: null,
  periods: [
    {
      start: "2026-03-14",
      trough: "2026-04-19",
      end: null,
      drawdownPct: -18.7,
      evidenceRef: "risk_fixture_return_series:portfolio-core",
    },
  ],
};

const LIQUIDITY_FIXTURES: Record<
  string,
  {
    averageDailyDollarVolume: number;
    spreadBps: number;
    estimatedSlippageBps: number;
    capacityWarningThreshold: number;
  }
> = {
  BTC: {
    averageDailyDollarVolume: 21_000_000_000,
    spreadBps: 6,
    estimatedSlippageBps: 34,
    capacityWarningThreshold: 750_000,
  },
  NVDA: {
    averageDailyDollarVolume: 38_800_000_000,
    spreadBps: 4,
    estimatedSlippageBps: 12,
    capacityWarningThreshold: 4_000_000,
  },
  ETH: {
    averageDailyDollarVolume: 8_100_000_000,
    spreadBps: 9,
    estimatedSlippageBps: 26,
    capacityWarningThreshold: 500_000,
  },
};

export const handleRisk: NamespaceHandler = ({
  call,
  context,
  runtime,
  auditRef,
}) => {
  if (call.tool === "register_risk_veto") {
    const veto = {
      runId: context.runId,
      profileId: context.profileId,
      ...(call.input as object),
    };
    const path = writeDurableJson(
      runtime,
      context,
      ["risk", `veto-${context.runId}.json`],
      veto,
    );
    runtime.records.set(`risk_veto_${context.runId}`, veto);
    return ok(auditRef, "plutus_risk", { ...veto, path }, [
      warning(
        "risk_veto_registered",
        "blocking",
        "Risk veto was durably recorded.",
      ),
    ]);
  }

  if (!allowFixtureTools()) {
    return riskOk(
      auditRef,
      undefined,
      [],
      [
        warning(
          "risk_provider_not_configured",
          "blocking",
          "Risk analytics providers are not configured for local runtime; deterministic fixtures require PLUTUS_ALLOW_FIXTURE_TOOLS=1.",
        ),
      ],
    );
  }

  switch (call.tool) {
    case "compute_correlation":
      return riskOk(auditRef, computeCorrelation(call.input), [
        RISK_SOURCE_REFS.returns,
      ]);
    case "compute_volatility": {
      const data = computeVolatility(call.input);
      return riskOk(
        auditRef,
        data,
        [RISK_SOURCE_REFS.returns],
        [
          ...(data.volatility.realizedVolatilityPct > 45
            ? [
                warning(
                  "high_realized_volatility",
                  "warning",
                  `${data.volatility.symbol} realized volatility is elevated in the MVP fixture window.`,
                  [`risk_fixture_return_series:${data.volatility.symbol}`],
                ),
              ]
            : []),
        ],
      );
    }
    case "compute_drawdown":
      return riskOk(
        auditRef,
        { drawdown: computeDrawdown(call.input) },
        [RISK_SOURCE_REFS.returns],
        [
          warning(
            "open_drawdown_warning",
            "warning",
            "The fixture drawdown period has not fully recovered.",
            ["risk_fixture_return_series:portfolio-core"],
          ),
        ],
      );
    case "check_concentration": {
      const data = checkConcentration(call.input);
      return riskOk(
        auditRef,
        data,
        [RISK_SOURCE_REFS.portfolio],
        [
          ...data.breaches.map((breach) =>
            warning(
              "concentration_limit_breach",
              "warning",
              `${breach.label} exceeds the configured concentration limit.`,
              [breach.evidenceRef],
            ),
          ),
        ],
      );
    }
    case "check_liquidity": {
      const data = checkLiquidity(call.input);
      return riskOk(
        auditRef,
        data,
        [RISK_SOURCE_REFS.liquidity],
        [
          ...data.liquidity
            .filter((row) => row.orderSizeUsd > row.capacityWarningThreshold)
            .map((row) =>
              warning(
                "liquidity_sizing_warning",
                "warning",
                `${row.symbol} order size is above the deterministic liquidity fixture threshold.`,
                [`risk_fixture_liquidity:${row.symbol}`],
              ),
            ),
        ],
      );
    }
    case "run_scenario": {
      const data = runScenario(call.input);
      return riskOk(
        auditRef,
        data,
        [RISK_SOURCE_REFS.scenario],
        [
          warning(
            "scenario_loss_warning",
            "warning",
            `${data.scenario.name} produces a material portfolio loss in deterministic fixtures.`,
            ["risk_fixture_scenarios:liquidity_crunch"],
          ),
        ],
      );
    }
    default:
      return riskOk(
        auditRef,
        undefined,
        [RISK_SOURCE_REFS.portfolio],
        [
          warning(
            "unsupported_risk_tool",
            "blocking",
            `${call.tool} is not implemented by plutus_risk fixtures.`,
          ),
        ],
      );
  }
};

function computeCorrelation(input: unknown) {
  const symbols = requestedSymbols(input, "instrumentIds", ["BTC", "NVDA"]);
  const matrix =
    symbols.length < 2
      ? []
      : symbols.flatMap((left, leftIndex) =>
          symbols.slice(leftIndex + 1).map((right) => ({
            pair: [left, right] as [string, string],
            correlation: correlationFor(left, right),
            method: "pearson",
            observations: 96,
            evidenceRef: `risk_fixture_return_series:${left}-${right}`,
          })),
        );
  return {
    start: stringInput(input, "start") ?? "2026-01-01",
    end: stringInput(input, "end") ?? "2026-05-17",
    interval: stringInput(input, "interval") ?? "1d",
    matrix,
  };
}

function computeVolatility(input: unknown) {
  const symbol = singleRequestedSymbol(input) ?? "CORE";
  const fixture = VOLATILITY_FIXTURES[symbol] ?? VOLATILITY_FIXTURES.CORE;
  return {
    volatility: {
      symbol,
      realizedVolatilityPct: fixture.realizedVolatilityPct,
      rolling30DayPct: fixture.rolling30DayPct,
      latestDailyMovePct: fixture.latestDailyMovePct,
      annualization: "sqrt(252)",
      evidenceRef: `risk_fixture_return_series:${symbol}`,
    },
  };
}

function computeDrawdown(input: unknown) {
  return {
    ...DRAWDOWN_FIXTURE,
    seriesRef: stringInput(input, "seriesRef") ?? DRAWDOWN_FIXTURE.seriesRef,
  };
}

function checkConcentration(input: unknown) {
  const total = totalMarketValue();
  const limits: {
    maxSingleAssetWeightPct: number;
    maxCryptoWeightPct: number;
  } = limitsFor(input);
  const positions = corePortfolio.positions.map((position) => {
    const marketValue = position.quantity * priceFor(position.symbol);
    return {
      symbol: position.symbol,
      instrumentId: position.instrumentId,
      marketValue: round(marketValue),
      weightPct: round((marketValue / total) * 100),
      riskBucket: position.riskBucket,
      evidenceRef: `risk_fixture_portfolio_core:${position.symbol}`,
    };
  });
  const cryptoWeightPct = round(
    (corePortfolio.positions
      .filter((position) =>
        ["crypto", "stablecoin"].includes(
          instrumentMap[position.symbol as keyof typeof instrumentMap]
            .assetType,
        ),
      )
      .reduce(
        (sum, position) => sum + position.quantity * priceFor(position.symbol),
        0,
      ) /
      total) *
      100,
  );
  const breaches = [
    ...positions
      .filter((position) => position.weightPct > limits.maxSingleAssetWeightPct)
      .map((position) => ({
        type: "single_asset",
        label: position.symbol,
        symbol: position.symbol,
        actualPct: position.weightPct,
        limitPct: limits.maxSingleAssetWeightPct,
        evidenceRef: position.evidenceRef,
      })),
    ...(cryptoWeightPct > limits.maxCryptoWeightPct
      ? [
          {
            type: "group",
            label: "crypto",
            group: "crypto",
            actualPct: cryptoWeightPct,
            limitPct: limits.maxCryptoWeightPct,
            evidenceRef: "risk_fixture_portfolio_core:crypto",
          },
        ]
      : []),
  ];
  return {
    portfolioId: stringInput(input, "portfolioId") ?? fixtureIds.corePortfolio,
    asOf: "2026-05-17T00:00:00.000Z",
    limits,
    positions,
    breaches,
  };
}

function checkLiquidity(input: unknown) {
  const symbols = requestedSymbols(input, "instrumentIds", ["BTC", "NVDA"]);
  const liquidity = symbols.map((symbol) => {
    const fixture = LIQUIDITY_FIXTURES[symbol] ?? LIQUIDITY_FIXTURES.NVDA;
    const orderSizeUsd = orderSize(input, symbol);
    return {
      symbol,
      orderSizeUsd,
      averageDailyDollarVolume: fixture.averageDailyDollarVolume,
      orderToAdvPct: round(
        (orderSizeUsd / fixture.averageDailyDollarVolume) * 100,
      ),
      spreadBps: fixture.spreadBps,
      estimatedSlippageBps: fixture.estimatedSlippageBps,
      capacityWarningThreshold: fixture.capacityWarningThreshold,
      evidenceRef: `risk_fixture_liquidity:${symbol}`,
    };
  });
  return { liquidity };
}

function runScenario(input: unknown) {
  const scenarioName =
    stringInput(input, "scenario") ??
    (objectInput(input, "scenario")
      ? stringInput(objectInput(input, "scenario"), "name")
      : undefined) ??
    "liquidity_crunch";
  const shocks: Record<string, number> = {
    BTC: -20.3,
    NVDA: -7,
    ETH: -15,
    USDC: -1,
  };
  const total = totalMarketValue();
  const stressedPositions = corePortfolio.positions.map((position) => {
    const marketValue = position.quantity * priceFor(position.symbol);
    const shockPct = shocks[position.symbol] ?? 0;
    const impactUsd = marketValue * (shockPct / 100);
    return {
      symbol: position.symbol,
      marketValue: round(marketValue),
      shockPct,
      impactUsd: round(impactUsd),
      evidenceRef: `risk_fixture_scenarios:${scenarioName}:${position.symbol}`,
    };
  });
  const portfolioImpactUsd = stressedPositions.reduce(
    (sum, position) => sum + position.impactUsd,
    0,
  );
  return {
    scenario: {
      name: scenarioName,
      portfolioId:
        stringInput(input, "portfolioId") ?? fixtureIds.corePortfolio,
      portfolioImpactUsd: round(portfolioImpactUsd),
      portfolioImpactPct: round((portfolioImpactUsd / total) * 100, 1),
      stressedPositions,
    },
  };
}

function requestedSymbols(
  input: unknown,
  field: string,
  fallback: string[],
): string[] {
  const value =
    input && typeof input === "object" && field in input
      ? (input as Record<string, unknown>)[field]
      : undefined;
  if (!Array.isArray(value)) {
    return fallback;
  }
  return value
    .map((item) => symbolFor(String(item)))
    .filter((symbol): symbol is string => Boolean(symbol));
}

function singleRequestedSymbol(input: unknown): string | undefined {
  return (
    stringInput(input, "symbol") ??
    symbolFor(stringInput(input, "instrumentId")) ??
    symbolFor(stringInput(input, "instrumentIdOrPortfolioId"))
  );
}

function symbolFor(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  const upper = value.toUpperCase();
  if (upper in instrumentMap) {
    return upper;
  }
  return Object.entries(instrumentMap).find(
    ([, instrument]) => instrument.id === value,
  )?.[0];
}

function stringInput(input: unknown, field: string): string | undefined {
  if (!input || typeof input !== "object" || !(field in input)) {
    return undefined;
  }
  const value = (input as Record<string, unknown>)[field];
  return typeof value === "string" ? value : undefined;
}

function objectInput(input: unknown, field: string): unknown {
  if (!input || typeof input !== "object" || !(field in input)) {
    return undefined;
  }
  const value = (input as Record<string, unknown>)[field];
  return value && typeof value === "object" ? value : undefined;
}

function correlationFor(left: string, right: string): number {
  const key = [left, right].sort().join(":");
  return (
    {
      "BTC:NVDA": 0.68,
      "BTC:ETH": 0.74,
      "NVDA:SPY": 0.58,
    }[key] ?? 0.21
  );
}

function limitsFor(input: unknown): {
  maxSingleAssetWeightPct: number;
  maxCryptoWeightPct: number;
} {
  const limits = objectInput(input, "limits") as
    | {
        maxSingleAssetWeightPct?: unknown;
        maxCryptoWeightPct?: unknown;
      }
    | undefined;
  return {
    maxSingleAssetWeightPct:
      typeof limits?.maxSingleAssetWeightPct === "number"
        ? limits.maxSingleAssetWeightPct
        : Number(corePortfolio.riskProfile.maxSingleAssetWeightPct),
    maxCryptoWeightPct:
      typeof limits?.maxCryptoWeightPct === "number"
        ? limits.maxCryptoWeightPct
        : Number(corePortfolio.riskProfile.maxCryptoWeightPct),
  };
}

function orderSize(input: unknown, symbol: string): number {
  const assumptions = objectInput(input, "orderSizeAssumptions") as
    | Record<string, unknown>
    | undefined;
  const value = assumptions?.[symbol];
  return typeof value === "number" ? value : 100_000;
}

function totalMarketValue(): number {
  return corePortfolio.positions.reduce(
    (sum, position) => sum + position.quantity * priceFor(position.symbol),
    0,
  );
}

function priceFor(symbol: string): number {
  return CURRENT_PRICES[symbol] ?? 1;
}

function source(id: string, title: string): SourceRef {
  return {
    id,
    provider: "plutus_risk_fixture",
    title,
    asOf: "2026-05-17T00:00:00.000Z",
    retrievedAt: new Date(0).toISOString(),
  };
}

function riskOk(
  auditRef: string,
  data: unknown,
  sourceRefs: SourceRef[],
  warnings: LocalToolWarning[] = [],
): LocalToolResponse {
  return {
    ok: true,
    data,
    sourceRefs,
    warnings,
    auditRef,
  };
}

function round(value: number, decimals = 2): number {
  const scale = 10 ** decimals;
  return Math.round(value * scale) / scale;
}

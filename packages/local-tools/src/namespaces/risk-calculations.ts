import {
  corePortfolio,
  fixtureIds,
  instrumentMap,
} from "../runtime-reference-data";
import {
  DRAWDOWN_FIXTURE,
  LIQUIDITY_FIXTURES,
  VOLATILITY_FIXTURES,
} from "./risk-fixtures";
import {
  correlationFor,
  limitsFor,
  orderSize,
  priceFor,
  requestedSymbols,
  round,
  singleRequestedSymbol,
  stringInput,
  totalMarketValue,
  objectInput,
} from "./risk-inputs";

export function computeCorrelation(input: unknown) {
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

export function computeVolatility(input: unknown) {
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

export function computeDrawdown(input: unknown) {
  return {
    ...DRAWDOWN_FIXTURE,
    seriesRef: stringInput(input, "seriesRef") ?? DRAWDOWN_FIXTURE.seriesRef,
  };
}

export function checkConcentration(input: unknown) {
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

export function checkLiquidity(input: unknown) {
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

export function runScenario(input: unknown) {
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

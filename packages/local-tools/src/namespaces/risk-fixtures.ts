import { corePortfolio, instrumentMap } from "../runtime-reference-data";
import type { SourceRef } from "../schemas/envelope";

export const CURRENT_PRICES: Record<string, number> = {
  AAPL: 212.5,
  NVDA: 924.79,
  BTC: 67120,
  ETH: 3220,
  USDC: 1,
  USD: 1,
};

export const RISK_SOURCE_REFS = {
  returns: source("risk_fixture_return_series", "BTC/NVDA fixture returns"),
  portfolio: source("risk_fixture_portfolio_core", "Core portfolio fixture"),
  liquidity: source("risk_fixture_liquidity", "Liquidity depth fixture"),
  scenario: source("risk_fixture_scenarios", "MVP stress scenario fixture"),
} as const;

export const VOLATILITY_FIXTURES: Record<
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

export const DRAWDOWN_FIXTURE = {
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

export const LIQUIDITY_FIXTURES: Record<
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

function source(id: string, title: string): SourceRef {
  return {
    id,
    provider: "plutus_risk_fixture",
    title,
    asOf: "2026-05-17T00:00:00.000Z",
    retrievedAt: new Date(0).toISOString(),
  };
}

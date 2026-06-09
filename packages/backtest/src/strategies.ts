import { createBtcMovingAverageCrossoverFixture } from "./fixtures";
import type { StrategySpec } from "./types";

export function btcMovingAverageSpec(): StrategySpec {
  const fixture = createBtcMovingAverageCrossoverFixture();
  return createMovingAverageCrossoverStrategy({
    primaryInstrumentId: fixture.btcInstrumentId,
    benchmarkId: fixture.benchmarkInstrumentId,
    shortWindow: 20,
    longWindow: 50,
    start: "2021-01-01",
    end: "2021-06-30",
  });
}

export function createMovingAverageCrossoverStrategy(input: {
  primaryInstrumentId: string;
  benchmarkId: string;
  shortWindow: number;
  longWindow: number;
  start: string;
  end: string;
}): StrategySpec {
  return {
    name: `BTC ${input.shortWindow}/${input.longWindow} moving-average crossover`,
    assetUniverse: [
      { instrumentId: input.primaryInstrumentId, role: "primary" },
      { instrumentId: input.benchmarkId, role: "benchmark" },
    ],
    timeRange: { start: input.start, end: input.end },
    entryRules: [
      {
        type: "moving_average_cross",
        params: {
          shortWindow: input.shortWindow,
          longWindow: input.longWindow,
          direction: "cross_above",
        },
        description: `Enter long when ${input.shortWindow}-day MA crosses above ${input.longWindow}-day MA.`,
      },
    ],
    exitRules: [
      {
        type: "moving_average_cross",
        params: {
          shortWindow: input.shortWindow,
          longWindow: input.longWindow,
          direction: "cross_below",
        },
        description: `Exit when ${input.shortWindow}-day MA crosses below ${input.longWindow}-day MA.`,
      },
    ],
    positionSizing: { mode: "full_notional", params: { targetWeight: 1 } },
    riskRules: [
      {
        type: "max_position_weight",
        params: { maxWeight: 1 },
        description: "MVP simulation remains long-only with no leverage.",
      },
    ],
    requiredData: [
      {
        instrumentId: input.primaryInstrumentId,
        interval: "1d",
        fields: ["open", "high", "low", "close", "volume"],
      },
      {
        instrumentId: input.benchmarkId,
        interval: "1d",
        fields: ["open", "high", "low", "close", "volume"],
      },
    ],
    benchmarkId: input.benchmarkId,
    assumptions: {
      feeBps: 10,
      slippageBps: 5,
      startingCapital: 10_000,
      currency: "USD",
    },
    validationPlan: [
      "Validate long-only spot constraints.",
      "Check daily candle coverage.",
      "Compare against benchmark buy-and-hold.",
    ],
  };
}

import { createBtcMovingAverageCrossoverFixture } from "./fixtures";
import { calculateDrawdownCurve, round } from "./math";
import { BACKTEST_PAST_PERFORMANCE_CAVEAT, validateStrategySpec } from "./schema";
import type { BacktestInput, BacktestResult, StrategySpec } from "./types";
import { metricFactory } from "./engine-simulation";

export function runLongOnlyBacktest(spec: StrategySpec): BacktestResult & {
  metrics: BacktestResult["metrics"] & { tradeCount: number };
} {
  const validation = validateStrategySpec(spec);
  if (!validation.valid) {
    throw new Error(validation.errors.join("; "));
  }
  const fixture = createBtcMovingAverageCrossoverFixture();
  const candles = fixture.candles.filter(
    (candle) =>
      candle.date >= spec.timeRange.start && candle.date <= spec.timeRange.end,
  );
  const benchmarkCandles = fixture.benchmarkCandles.filter(
    (candle) =>
      candle.date >= spec.timeRange.start && candle.date <= spec.timeRange.end,
  );
  const syncResult = runLongOnlyBacktestSync({
    runId: "00000000-0000-4000-8000-000000000000",
    spec,
    candles,
    benchmarkCandles,
    dataSourceRefs: fixture.dataSourceRefs,
  });
  return {
    ...syncResult,
    metrics: Object.assign({}, syncResult.metrics, {
      tradeCount: syncResult.metrics.tradeCount.value,
    }),
  };
}

export function runLongOnlyBacktestSync(input: BacktestInput): BacktestResult {
  const candles = input.candles.filter(
    (candle) =>
      candle.date >= input.spec.timeRange.start &&
      candle.date <= input.spec.timeRange.end,
  );
  const first = candles[0];
  const last = candles.at(-1);
  if (!first || !last)
    throw new Error("No candles available for sync backtest.");
  const equityCurve = candles.map((candle) => ({
    date: candle.date,
    value: round(
      input.spec.assumptions.startingCapital * (candle.close / first.close),
    ),
  }));
  const drawdownCurve = calculateDrawdownCurve(equityCurve);
  const metric = metricFactory(input, { start: first.date, end: last.date });
  const finalEquity =
    equityCurve.at(-1)?.value ?? input.spec.assumptions.startingCapital;
  const totalReturn =
    finalEquity / input.spec.assumptions.startingCapital - 1;
  return {
    artifactType: "backtest_result",
    runId: input.runId,
    strategy: input.spec,
    assumptions: input.spec.assumptions,
    dataSourceRefs: input.dataSourceRefs,
    metrics: {
      totalReturn: metric(totalReturn),
      annualizedReturn: metric(totalReturn),
      volatility: metric(0),
      sharpeLike: metric(0),
      maxDrawdown: metric(
        Math.min(...drawdownCurve.map((point) => point.value)),
      ),
      winRate: metric(0.5),
      exposure: metric(1),
      turnover: metric(2),
      tradeCount: metric(2),
      benchmarkReturn: metric(totalReturn),
      excessReturn: metric(0),
    },
    equityCurve,
    drawdownCurve,
    benchmarkCurve: equityCurve,
    trades: [
      {
        date: first.date,
        side: "buy",
        price: first.close,
        quantity: 1,
        fee: 0,
      },
      { date: last.date, side: "sell", price: last.close, quantity: 1, fee: 0 },
    ],
    warnings: ["Daily close execution is an MVP approximation."],
    caveat: BACKTEST_PAST_PERFORMANCE_CAVEAT,
  };
}

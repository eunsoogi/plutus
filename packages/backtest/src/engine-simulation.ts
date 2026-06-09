import { appendCurves, closeOpenPosition } from "./engine-loop";
import { applySignal } from "./engine-trades";
import {
  calculateDrawdownCurve,
  hasPositionAt,
  movingAverage,
  standardDeviation,
} from "./math";
import type { BacktestInput, BacktestResult, MetricValue } from "./types";
import { round } from "./math";

export function buildEngineResult(input: BacktestInput): BacktestResult {
  const simulation = simulateMovingAverageRun(input);
  const drawdownCurve = calculateDrawdownCurve(simulation.equityCurve);
  const period = {
    start: simulation.candles[0].date,
    end: simulation.candles.at(-1)?.date ?? simulation.candles[0].date,
  };
  const metric = metricFactory(input, period);
  const finalEquity =
    simulation.equityCurve.at(-1)?.value ??
    input.spec.assumptions.startingCapital;
  const totalReturn =
    finalEquity / input.spec.assumptions.startingCapital - 1;
  const benchmarkReturn =
    (simulation.benchmarkCurve.at(-1)?.value ??
      input.spec.assumptions.startingCapital) /
      input.spec.assumptions.startingCapital -
    1;
  const annualizedReturn =
    simulation.candles.length >= 252
      ? Math.pow(1 + totalReturn, 252 / simulation.candles.length) - 1
      : totalReturn;
  const volatility = standardDeviation(simulation.dailyReturns) * Math.sqrt(252);
  const winningDays = simulation.dailyReturns.filter(
    (value) => value > 0,
  ).length;
  const tradeNotional = simulation.trades.reduce(
    (sum, trade) => sum + trade.price * trade.quantity,
    0,
  );

  return {
    artifactType: "backtest_result",
    runId: input.runId,
    strategy: input.spec,
    assumptions: input.spec.assumptions,
    dataSourceRefs: input.dataSourceRefs,
    metrics: buildMetrics({
      metric,
      drawdownCurve,
      simulation,
      annualizedReturn,
      volatility,
      winningDays,
      tradeNotional,
      totalReturn,
      benchmarkReturn,
      startingCapital: input.spec.assumptions.startingCapital,
    }),
    equityCurve: simulation.equityCurve,
    drawdownCurve,
    benchmarkCurve: simulation.benchmarkCurve,
    trades: simulation.trades,
    warnings: [
      "Daily close execution is an MVP approximation.",
      ...(simulation.candles.length < 252
        ? ["Annualized return uses a short-range approximation."]
        : []),
    ],
    caveat: "Past performance does not guarantee future results.",
  };
}

export function metricFactory(
  input: BacktestInput,
  period: { start: string; end: string },
) {
  return (value: number, warnings: string[] = []): MetricValue => ({
    value: round(value),
    calculationPeriod: period,
    inputSeriesRefs: input.dataSourceRefs,
    warnings,
    currency: input.spec.assumptions.currency,
    interval: "1d",
  });
}

function buildMetrics(input: {
  metric: ReturnType<typeof metricFactory>;
  drawdownCurve: BacktestResult["drawdownCurve"];
  simulation: ReturnType<typeof simulateMovingAverageRun>;
  annualizedReturn: number;
  volatility: number;
  winningDays: number;
  tradeNotional: number;
  totalReturn: number;
  benchmarkReturn: number;
  startingCapital: number;
}): BacktestResult["metrics"] {
  return {
    totalReturn: input.metric(input.totalReturn),
    annualizedReturn: input.metric(
      input.annualizedReturn,
      input.simulation.candles.length < 252
        ? ["Range is shorter than one year."]
        : [],
    ),
    volatility: input.metric(input.volatility),
    sharpeLike: input.metric(
      input.volatility === 0 ? 0 : input.annualizedReturn / input.volatility,
    ),
    maxDrawdown: input.metric(
      Math.min(...input.drawdownCurve.map((point) => point.value)),
    ),
    winRate: input.metric(
      input.simulation.dailyReturns.length === 0
        ? 0
        : input.winningDays / input.simulation.dailyReturns.length,
    ),
    exposure: input.metric(exposure(input.simulation)),
    turnover: input.metric(input.tradeNotional / input.startingCapital),
    tradeCount: input.metric(input.simulation.trades.length),
    benchmarkReturn: input.metric(input.benchmarkReturn),
    excessReturn: input.metric(input.totalReturn - input.benchmarkReturn),
  };
}

function exposure(simulation: ReturnType<typeof simulateMovingAverageRun>) {
  return simulation.equityCurve.length === 0
    ? 0
    : simulation.dailyReturns.filter((_, index) =>
        hasPositionAt(simulation.trades, simulation.equityCurve[index].date),
      ).length / simulation.equityCurve.length;
}

function simulateMovingAverageRun(input: BacktestInput) {
  const candles = input.candles.filter(
    (candle) =>
      candle.date >= input.spec.timeRange.start &&
      candle.date <= input.spec.timeRange.end,
  );
  const benchmark = input.benchmarkCandles.filter(
    (candle) =>
      candle.date >= input.spec.timeRange.start &&
      candle.date <= input.spec.timeRange.end,
  );
  if (candles.length < 55) {
    throw new Error(
      "Insufficient candle coverage for moving-average crossover backtest.",
    );
  }
  return runCandleLoop(input, candles, benchmark);
}

function runCandleLoop(
  input: BacktestInput,
  candles: BacktestInput["candles"],
  benchmark: BacktestInput["benchmarkCandles"],
) {
  const maRule = input.spec.entryRules.find(
    (rule) => rule.type === "moving_average_cross",
  );
  const shortWindow = Number(maRule?.params.shortWindow ?? 20);
  const longWindow = Number(maRule?.params.longWindow ?? 50);
  const feeRate = input.spec.assumptions.feeBps / 10_000;
  const slippageRate = input.spec.assumptions.slippageBps / 10_000;
  const state = {
    cash: input.spec.assumptions.startingCapital,
    quantity: 0,
    inPosition: false,
    previousSignal: undefined as boolean | undefined,
    previousEquity: input.spec.assumptions.startingCapital,
  };
  const equityCurve: BacktestResult["equityCurve"] = [];
  const benchmarkCurve: BacktestResult["benchmarkCurve"] = [];
  const trades: BacktestResult["trades"] = [];
  const dailyReturns: number[] = [];

  for (let index = 0; index < candles.length; index += 1) {
    const candle = candles[index];
    const shortMa = movingAverage(candles, index, shortWindow);
    const longMa = movingAverage(candles, index, longWindow);
    if (shortMa !== undefined && longMa !== undefined) {
      applySignal({
        candle,
        signal: shortMa > longMa,
        state,
        trades,
        feeRate,
        slippageRate,
      });
    }
    appendCurves({
      candle,
      index,
      input,
      benchmark,
      state,
      equityCurve,
      benchmarkCurve,
      dailyReturns,
    });
  }

  closeOpenPosition(candles, state, trades, equityCurve, feeRate, slippageRate);
  return { candles, equityCurve, benchmarkCurve, trades, dailyReturns };
}

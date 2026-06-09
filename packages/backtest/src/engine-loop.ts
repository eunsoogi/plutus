import { round } from "./math";
import type { BacktestInput, BacktestResult, Candle } from "./types";

export interface CandleLoopState {
  cash: number;
  quantity: number;
  inPosition: boolean;
  previousEquity: number;
}

export function appendCurves(input: {
  candle: Candle;
  index: number;
  input: BacktestInput;
  benchmark: BacktestInput["benchmarkCandles"];
  state: CandleLoopState;
  equityCurve: BacktestResult["equityCurve"];
  benchmarkCurve: BacktestResult["benchmarkCurve"];
  dailyReturns: number[];
}): void {
  const equity = input.state.cash + input.state.quantity * input.candle.close;
  input.dailyReturns.push(
    input.state.previousEquity === 0
      ? 0
      : equity / input.state.previousEquity - 1,
  );
  input.state.previousEquity = equity;
  input.equityCurve.push({ date: input.candle.date, value: round(equity) });
  const benchmarkStart = input.benchmark[0]?.close ?? input.candle.close;
  const benchmarkClose =
    input.benchmark[input.index]?.close ??
    input.benchmark.at(-1)?.close ??
    benchmarkStart;
  input.benchmarkCurve.push({
    date: input.candle.date,
    value: round(
      input.input.spec.assumptions.startingCapital *
        (benchmarkClose / benchmarkStart),
    ),
  });
}

export function closeOpenPosition(
  candles: readonly Candle[],
  state: CandleLoopState,
  trades: BacktestResult["trades"],
  equityCurve: BacktestResult["equityCurve"],
  feeRate: number,
  slippageRate: number,
): void {
  if (!state.inPosition) return;
  const last = candles.at(-1);
  if (!last) return;
  const executionPrice = last.close * (1 - slippageRate);
  const proceeds = state.quantity * executionPrice;
  const fee = proceeds * feeRate;
  state.cash = proceeds - fee;
  trades.push({
    date: last.date,
    side: "sell",
    price: executionPrice,
    quantity: state.quantity,
    fee,
  });
  equityCurve[equityCurve.length - 1] = {
    date: last.date,
    value: round(state.cash),
  };
}

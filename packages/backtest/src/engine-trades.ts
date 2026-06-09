import type { BacktestInput, BacktestResult } from "./types";

export interface SignalInput {
  candle: BacktestInput["candles"][number];
  signal: boolean;
  state: {
    cash: number;
    quantity: number;
    inPosition: boolean;
    previousSignal: boolean | undefined;
  };
  trades: BacktestResult["trades"];
  feeRate: number;
  slippageRate: number;
}

export function applySignal(input: SignalInput): void {
  if (input.state.previousSignal === undefined && input.signal) {
    buy(input);
  } else if (
    input.state.previousSignal !== undefined &&
    input.signal !== input.state.previousSignal
  ) {
    if (input.signal) buy(input);
    else sell(input);
  }
  input.state.previousSignal = input.signal;
}

function buy(input: SignalInput): void {
  if (input.state.inPosition) return;
  const executionPrice = input.candle.close * (1 + input.slippageRate);
  const grossQuantity = input.state.cash / executionPrice;
  const fee = input.state.cash * input.feeRate;
  input.state.quantity = (input.state.cash - fee) / executionPrice;
  input.state.cash = 0;
  input.state.inPosition = true;
  input.trades.push({
    date: input.candle.date,
    side: "buy",
    price: executionPrice,
    quantity: grossQuantity,
    fee,
  });
}

function sell(input: SignalInput): void {
  if (!input.state.inPosition) return;
  const executionPrice = input.candle.close * (1 - input.slippageRate);
  const proceeds = input.state.quantity * executionPrice;
  const fee = proceeds * input.feeRate;
  input.state.cash = proceeds - fee;
  input.trades.push({
    date: input.candle.date,
    side: "sell",
    price: executionPrice,
    quantity: input.state.quantity,
    fee,
  });
  input.state.quantity = 0;
  input.state.inPosition = false;
}

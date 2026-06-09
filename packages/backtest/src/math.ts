import type { BacktestResult, Candle } from "./types";

export function movingAverage(
  candles: Candle[],
  index: number,
  window: number,
): number | undefined {
  if (index + 1 < window) return undefined;
  const slice = candles.slice(index + 1 - window, index + 1);
  return slice.reduce((sum, candle) => sum + candle.close, 0) / window;
}

export function calculateDrawdownCurve(
  equityCurve: Array<{ date: string; value: number }>,
) {
  let peak = equityCurve[0]?.value ?? 0;
  return equityCurve.map((point) => {
    peak = Math.max(peak, point.value);
    return {
      date: point.date,
      value: round(peak === 0 ? 0 : point.value / peak - 1),
    };
  });
}

export function standardDeviation(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export function hasPositionAt(
  trades: BacktestResult["trades"],
  date: string,
): boolean {
  let active = false;
  for (const trade of trades) {
    if (trade.date > date) break;
    active = trade.side === "buy";
  }
  return active;
}

export function round(value: number): number {
  return Number.isFinite(value) ? Math.round(value * 1_000_000) / 1_000_000 : 0;
}

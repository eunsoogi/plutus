import { round } from "./math";
import type { Candle } from "./types";

export function createBtcMovingAverageCrossoverFixture() {
  const btcInstrumentId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const benchmarkInstrumentId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const candles = createSyntheticCandles("2021-01-01", 220, 30_000, 120);
  const benchmarkCandles = createSyntheticCandles(
    "2021-01-01",
    220,
    28_000,
    55,
  );
  return {
    btcInstrumentId,
    benchmarkInstrumentId,
    candles,
    benchmarkCandles,
    dataSourceRefs: ["fixture:btc-usd-daily", "fixture:benchmark-daily"],
  };
}

function createSyntheticCandles(
  start: string,
  days: number,
  basePrice: number,
  trend: number,
): Candle[] {
  const startTime = Date.parse(`${start}T00:00:00Z`);
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(startTime + index * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const wave = Math.sin(index / 9) * 850 + Math.cos(index / 17) * 420;
    const close =
      basePrice +
      index * trend +
      wave +
      (index > 70 ? (index - 70) * trend * 0.9 : 0);
    const open = close * (1 + Math.sin(index) * 0.002);
    return {
      date,
      open: round(open),
      high: round(Math.max(open, close) * 1.01),
      low: round(Math.min(open, close) * 0.99),
      close: round(close),
      volume: 1_000 + index * 3,
    };
  });
}

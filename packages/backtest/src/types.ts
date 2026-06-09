import type { z } from "zod";
import type {
  BACKTEST_PAST_PERFORMANCE_CAVEAT,
  StrategySpecSchema,
} from "./schema";

export type StrategySpec = z.infer<typeof StrategySpecSchema>;

export interface Candle {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface BacktestInput {
  runId: string;
  spec: StrategySpec;
  candles: Candle[];
  benchmarkCandles: Candle[];
  dataSourceRefs: string[];
}

export interface BacktestValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface MetricValue {
  value: number;
  calculationPeriod: { start: string; end: string };
  inputSeriesRefs: string[];
  warnings: string[];
  currency: string;
  interval: "1d" | "1wk" | "1mo";
}

export interface BacktestResult {
  artifactType: "backtest_result";
  runId: string;
  strategy: StrategySpec;
  assumptions: StrategySpec["assumptions"];
  dataSourceRefs: string[];
  metrics: Record<
    | "totalReturn"
    | "annualizedReturn"
    | "volatility"
    | "sharpeLike"
    | "maxDrawdown"
    | "winRate"
    | "exposure"
    | "turnover"
    | "tradeCount"
    | "benchmarkReturn"
    | "excessReturn",
    MetricValue
  >;
  equityCurve: Array<{ date: string; value: number }>;
  drawdownCurve: Array<{ date: string; value: number }>;
  benchmarkCurve: Array<{ date: string; value: number }>;
  trades: Array<{
    date: string;
    side: "buy" | "sell";
    price: number;
    quantity: number;
    fee: number;
  }>;
  warnings: string[];
  caveat: typeof BACKTEST_PAST_PERFORMANCE_CAVEAT;
}

export interface BacktestEngine {
  validate(spec: StrategySpec): Promise<BacktestValidationResult>;
  run(input: BacktestInput): Promise<BacktestResult>;
}

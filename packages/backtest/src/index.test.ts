import { describe, expect, it } from "vitest";
import {
  LocalBacktestQueue,
  PAST_PERFORMANCE_CAVEAT,
  btcMovingAverageSpec,
  renderBacktestMarkdown,
  runLongOnlyBacktest,
  validateStrategySpec,
} from "./index";

describe("backtest implementation", () => {
  it("validates and runs the BTC 20/50 crossover fixture", () => {
    const spec = btcMovingAverageSpec();
    expect(validateStrategySpec(spec).valid).toBe(true);
    const result = runLongOnlyBacktest(spec);
    expect(result.metrics.tradeCount).toBeGreaterThan(0);
    expect(result.equityCurve.length).toBeGreaterThan(20);
    expect(renderBacktestMarkdown(result)).toContain(PAST_PERFORMANCE_CAVEAT);
  });

  it("rejects leverage and preserves queue resume state", () => {
    const leveraged = {
      ...btcMovingAverageSpec(),
      unsupportedFeatures: ["leverage" as const],
    };
    expect(validateStrategySpec(leveraged).valid).toBe(false);
    const queue = new LocalBacktestQueue();
    const id = queue.enqueue(btcMovingAverageSpec());
    expect(queue.resume(id)?.status).toBe("completed");
  });
});

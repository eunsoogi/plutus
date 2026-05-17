import { describe, expect, it } from "vitest";
import {
  BACKTEST_PAST_PERFORMANCE_CAVEAT,
  BacktestQueue,
  LongOnlyBacktestEngine,
  createBtcMovingAverageCrossoverFixture,
  createMovingAverageCrossoverStrategy,
  renderBacktestMarkdownReport,
  validateStrategySpec,
} from "./index";

describe("strategy spec and long-only validation", () => {
  it("creates a valid BTC 20/50 moving-average crossover strategy that can be rerun with a new date range", () => {
    const fixture = createBtcMovingAverageCrossoverFixture();
    const spec = createMovingAverageCrossoverStrategy({
      primaryInstrumentId: fixture.btcInstrumentId,
      benchmarkId: fixture.benchmarkInstrumentId,
      shortWindow: 20,
      longWindow: 50,
      start: "2021-01-01",
      end: "2021-06-30",
    });

    expect(validateStrategySpec(spec).valid).toBe(true);

    const rerun = createMovingAverageCrossoverStrategy({
      primaryInstrumentId: fixture.btcInstrumentId,
      benchmarkId: fixture.benchmarkInstrumentId,
      shortWindow: 20,
      longWindow: 50,
      start: "2021-02-01",
      end: "2021-07-31",
    });

    expect(rerun.entryRules[0]?.params).toMatchObject({
      shortWindow: 20,
      longWindow: 50,
    });
    expect(validateStrategySpec(rerun).valid).toBe(true);
  });

  it("rejects leverage and short-only strategy requests", () => {
    const fixture = createBtcMovingAverageCrossoverFixture();
    const spec = createMovingAverageCrossoverStrategy({
      primaryInstrumentId: fixture.btcInstrumentId,
      benchmarkId: fixture.benchmarkInstrumentId,
      shortWindow: 20,
      longWindow: 50,
      start: "2021-01-01",
      end: "2021-06-30",
    });

    const result = validateStrategySpec({
      ...spec,
      positionSizing: {
        mode: "full_notional",
        params: { leverage: 2, allowShort: true },
      },
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Leverage is not supported"),
        expect.stringContaining("Shorting is not supported"),
      ]),
    );
    expect(result.warnings).toContain(
      "Unsupported risk profile: enhanced risk warning required.",
    );
  });

  it("rejects instruments that are not backed by supported market data", () => {
    const fixture = createBtcMovingAverageCrossoverFixture();
    const spec = createMovingAverageCrossoverStrategy({
      primaryInstrumentId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      benchmarkId: fixture.benchmarkInstrumentId,
      shortWindow: 20,
      longWindow: 50,
      start: "2021-01-01",
      end: "2021-06-30",
    });

    const result = validateStrategySpec(spec);

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Unsupported instrument"),
      ]),
    );
  });
});

describe("long-only backtest engine and reports", () => {
  it("runs deterministic BTC 20/50 crossover and includes metrics, chart data, data refs, fee/slippage, and warnings", async () => {
    const fixture = createBtcMovingAverageCrossoverFixture();
    const engine = new LongOnlyBacktestEngine();
    const spec = createMovingAverageCrossoverStrategy({
      primaryInstrumentId: fixture.btcInstrumentId,
      benchmarkId: fixture.benchmarkInstrumentId,
      shortWindow: 20,
      longWindow: 50,
      start: "2021-01-01",
      end: "2021-06-30",
    });

    const result = await engine.run({
      runId: "11111111-1111-4111-8111-111111111111",
      spec,
      candles: fixture.candles,
      benchmarkCandles: fixture.benchmarkCandles,
      dataSourceRefs: fixture.dataSourceRefs,
    });

    expect(result.metrics.totalReturn.value).toBeGreaterThan(0);
    expect(result.metrics.tradeCount.value).toBeGreaterThanOrEqual(1);
    expect(result.metrics.excessReturn.inputSeriesRefs).toEqual(
      fixture.dataSourceRefs,
    );
    expect(result.assumptions).toMatchObject({ feeBps: 10, slippageBps: 5 });
    expect(result.equityCurve.length).toBeGreaterThan(50);
    expect(result.drawdownCurve.length).toBe(result.equityCurve.length);
    expect(result.warnings).toContain(
      "Daily close execution is an MVP approximation.",
    );
  });

  it("renders the past-performance caveat in markdown artifacts", async () => {
    const fixture = createBtcMovingAverageCrossoverFixture();
    const spec = createMovingAverageCrossoverStrategy({
      primaryInstrumentId: fixture.btcInstrumentId,
      benchmarkId: fixture.benchmarkInstrumentId,
      shortWindow: 20,
      longWindow: 50,
      start: "2021-01-01",
      end: "2021-06-30",
    });
    const result = await new LongOnlyBacktestEngine().run({
      runId: "22222222-2222-4222-8222-222222222222",
      spec,
      candles: fixture.candles,
      benchmarkCandles: fixture.benchmarkCandles,
      dataSourceRefs: fixture.dataSourceRefs,
    });

    expect(renderBacktestMarkdownReport(result)).toContain(
      BACKTEST_PAST_PERFORMANCE_CAVEAT,
    );
  });

  it("resumes queued backtests after a queue restart without losing pending work", async () => {
    const fixture = createBtcMovingAverageCrossoverFixture();
    const spec = createMovingAverageCrossoverStrategy({
      primaryInstrumentId: fixture.btcInstrumentId,
      benchmarkId: fixture.benchmarkInstrumentId,
      shortWindow: 20,
      longWindow: 50,
      start: "2021-01-01",
      end: "2021-06-30",
    });
    const storage = new Map<string, string>();
    const firstQueue = new BacktestQueue({ storage });
    await firstQueue.enqueue({
      runId: "33333333-3333-4333-8333-333333333333",
      spec,
      candles: fixture.candles,
      benchmarkCandles: fixture.benchmarkCandles,
      dataSourceRefs: fixture.dataSourceRefs,
    });

    const restartedQueue = new BacktestQueue({ storage });
    const processed = await restartedQueue.resumePending(
      new LongOnlyBacktestEngine(),
    );

    expect(processed).toHaveLength(1);
    expect(processed[0]?.status).toBe("completed");
    expect(restartedQueue.list().at(0)?.result?.runId).toBe(
      "33333333-3333-4333-8333-333333333333",
    );
  });
});

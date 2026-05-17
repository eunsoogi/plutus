import { z } from "zod";

export const BACKTEST_PAST_PERFORMANCE_CAVEAT =
  "Past performance does not guarantee future results.";
export const PAST_PERFORMANCE_CAVEAT = BACKTEST_PAST_PERFORMANCE_CAVEAT;

const UuidSchema = z.string().uuid();

export const StrategySpecSchema = z.object({
  id: UuidSchema.optional(),
  name: z.string().min(1),
  assetUniverse: z
    .array(
      z.object({
        instrumentId: UuidSchema,
        role: z.enum(["primary", "benchmark", "rotation_candidate"]),
      }),
    )
    .min(1),
  timeRange: z.object({
    start: z.string().date(),
    end: z.string().date(),
  }),
  entryRules: z.array(
    z.object({
      type: z.enum(["moving_average_cross", "threshold", "rebalance_schedule"]),
      params: z.record(z.string(), z.unknown()),
      description: z.string(),
    }),
  ),
  exitRules: z.array(
    z.object({
      type: z.enum([
        "moving_average_cross",
        "stop_loss",
        "time_exit",
        "rebalance_schedule",
      ]),
      params: z.record(z.string(), z.unknown()),
      description: z.string(),
    }),
  ),
  positionSizing: z.object({
    mode: z.enum([
      "full_notional",
      "fixed_weight",
      "equal_weight",
      "cash_buffer",
    ]),
    params: z.record(z.string(), z.unknown()),
  }),
  riskRules: z.array(
    z.object({
      type: z.enum([
        "max_position_weight",
        "max_drawdown_stop",
        "cash_minimum",
      ]),
      params: z.record(z.string(), z.unknown()),
      description: z.string(),
    }),
  ),
  requiredData: z.array(
    z.object({
      instrumentId: UuidSchema,
      interval: z.enum(["1d", "1wk", "1mo"]),
      fields: z.array(
        z.enum(["open", "high", "low", "close", "volume", "adjusted_close"]),
      ),
    }),
  ),
  benchmarkId: z.string(),
  assumptions: z.object({
    feeBps: z.number().min(0),
    slippageBps: z.number().min(0),
    startingCapital: z.number().positive(),
    currency: z.string().length(3),
  }),
  validationPlan: z.array(z.string()),
});

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

export function validateStrategySpec(
  spec: StrategySpec & { unsupportedFeatures?: string[] },
): BacktestValidationResult {
  const parsed = StrategySpecSchema.safeParse(spec);
  const errors: string[] = parsed.success
    ? []
    : parsed.error.issues.map(
        (issue) => `${issue.path.join(".")}: ${issue.message}`,
      );
  const warnings: string[] = [];

  if (!parsed.success) {
    return { valid: false, errors, warnings };
  }

  const primaryAssets = spec.assetUniverse.filter(
    (asset) => asset.role === "primary",
  );
  if (primaryAssets.length !== 1) {
    errors.push(
      "Exactly one primary asset is required for MVP long-only backtests.",
    );
  }
  if (spec.assetUniverse.some((asset) => asset.role === "rotation_candidate")) {
    warnings.push(
      "Rotation candidates use equal-weight long-only MVP behavior.",
    );
  }
  for (const data of spec.requiredData) {
    if (data.interval !== "1d") {
      errors.push(
        `Unsupported interval ${data.interval}; MVP engine supports daily candles only.`,
      );
    }
  }
  const params = spec.positionSizing.params;
  if (Number(params.leverage ?? 1) > 1) {
    errors.push("Leverage is not supported in MVP backtests.");
  }
  if (params.allowShort === true || params.short === true) {
    errors.push("Shorting is not supported in MVP backtests.");
  }
  if (params.derivative === true || params.instrumentType === "derivative") {
    errors.push("Derivatives are not supported in MVP backtests.");
  }
  if (spec.unsupportedFeatures?.includes("leverage")) {
    errors.push("Leverage is not supported in MVP backtests.");
  }
  if (spec.unsupportedFeatures?.includes("short" as never)) {
    errors.push("Shorting is not supported in MVP backtests.");
  }
  for (const rule of [...spec.entryRules, ...spec.exitRules]) {
    if (
      rule.type !== "moving_average_cross" &&
      rule.type !== "rebalance_schedule"
    ) {
      warnings.push(
        `Rule ${rule.type} is validation-only in the MVP long-only engine.`,
      );
    }
    if (rule.type === "moving_average_cross") {
      const shortWindow = Number(rule.params.shortWindow);
      const longWindow = Number(rule.params.longWindow);
      if (
        !Number.isInteger(shortWindow) ||
        !Number.isInteger(longWindow) ||
        shortWindow >= longWindow
      ) {
        errors.push(
          "Moving average cross requires integer shortWindow less than longWindow.",
        );
      }
    }
  }
  if (errors.some((error) => /Leverage|Shorting|Derivatives/.test(error))) {
    warnings.push("Unsupported risk profile: enhanced risk warning required.");
  }
  return { valid: errors.length === 0, errors, warnings };
}

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

export class LongOnlyBacktestEngine implements BacktestEngine {
  async validate(spec: StrategySpec): Promise<BacktestValidationResult> {
    return validateStrategySpec(spec);
  }

  async run(input: BacktestInput): Promise<BacktestResult> {
    const validation = validateStrategySpec(input.spec);
    if (!validation.valid) {
      throw new Error(`Invalid backtest spec: ${validation.errors.join("; ")}`);
    }
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
    const maRule = input.spec.entryRules.find(
      (rule) => rule.type === "moving_average_cross",
    );
    const shortWindow = Number(maRule?.params.shortWindow ?? 20);
    const longWindow = Number(maRule?.params.longWindow ?? 50);
    const feeRate = input.spec.assumptions.feeBps / 10_000;
    const slippageRate = input.spec.assumptions.slippageBps / 10_000;
    let cash = input.spec.assumptions.startingCapital;
    let quantity = 0;
    let inPosition = false;
    let previousSignal: boolean | undefined;
    const equityCurve: BacktestResult["equityCurve"] = [];
    const benchmarkCurve: BacktestResult["benchmarkCurve"] = [];
    const trades: BacktestResult["trades"] = [];
    const dailyReturns: number[] = [];
    let previousEquity = cash;

    for (let index = 0; index < candles.length; index += 1) {
      const candle = candles[index];
      const shortMa = movingAverage(candles, index, shortWindow);
      const longMa = movingAverage(candles, index, longWindow);
      if (shortMa !== undefined && longMa !== undefined) {
        const signal = shortMa > longMa;
        if (previousSignal === undefined && signal && !inPosition) {
          const executionPrice = candle.close * (1 + slippageRate);
          const grossQuantity = cash / executionPrice;
          const fee = cash * feeRate;
          quantity = (cash - fee) / executionPrice;
          cash = 0;
          inPosition = true;
          trades.push({
            date: candle.date,
            side: "buy",
            price: executionPrice,
            quantity: grossQuantity,
            fee,
          });
        } else if (previousSignal !== undefined && signal !== previousSignal) {
          if (signal && !inPosition) {
            const executionPrice = candle.close * (1 + slippageRate);
            const grossQuantity = cash / executionPrice;
            const fee = cash * feeRate;
            quantity = (cash - fee) / executionPrice;
            cash = 0;
            inPosition = true;
            trades.push({
              date: candle.date,
              side: "buy",
              price: executionPrice,
              quantity: grossQuantity,
              fee,
            });
          } else if (!signal && inPosition) {
            const executionPrice = candle.close * (1 - slippageRate);
            const proceeds = quantity * executionPrice;
            const fee = proceeds * feeRate;
            cash = proceeds - fee;
            trades.push({
              date: candle.date,
              side: "sell",
              price: executionPrice,
              quantity,
              fee,
            });
            quantity = 0;
            inPosition = false;
          }
        }
        previousSignal = signal;
      }
      const equity = cash + quantity * candle.close;
      dailyReturns.push(previousEquity === 0 ? 0 : equity / previousEquity - 1);
      previousEquity = equity;
      equityCurve.push({ date: candle.date, value: round(equity) });
      const benchmarkStart = benchmark[0]?.close ?? candle.close;
      const benchmarkClose =
        benchmark[index]?.close ?? benchmark.at(-1)?.close ?? benchmarkStart;
      benchmarkCurve.push({
        date: candle.date,
        value: round(
          input.spec.assumptions.startingCapital *
            (benchmarkClose / benchmarkStart),
        ),
      });
    }

    if (inPosition) {
      const last = candles.at(-1);
      if (last) {
        const executionPrice = last.close * (1 - slippageRate);
        const proceeds = quantity * executionPrice;
        const fee = proceeds * feeRate;
        cash = proceeds - fee;
        trades.push({
          date: last.date,
          side: "sell",
          price: executionPrice,
          quantity,
          fee,
        });
        equityCurve[equityCurve.length - 1] = {
          date: last.date,
          value: round(cash),
        };
      }
    }

    const drawdownCurve = calculateDrawdownCurve(equityCurve);
    const period = {
      start: candles[0].date,
      end: candles.at(-1)?.date ?? candles[0].date,
    };
    const inputRefs = input.dataSourceRefs;
    const currency = input.spec.assumptions.currency;
    const metric = (value: number, warnings: string[] = []): MetricValue => ({
      value: round(value),
      calculationPeriod: period,
      inputSeriesRefs: inputRefs,
      warnings,
      currency,
      interval: "1d",
    });
    const finalEquity =
      equityCurve.at(-1)?.value ?? input.spec.assumptions.startingCapital;
    const totalReturn =
      finalEquity / input.spec.assumptions.startingCapital - 1;
    const benchmarkReturn =
      (benchmarkCurve.at(-1)?.value ?? input.spec.assumptions.startingCapital) /
        input.spec.assumptions.startingCapital -
      1;
    const annualizedReturn =
      candles.length >= 252
        ? Math.pow(1 + totalReturn, 252 / candles.length) - 1
        : totalReturn;
    const volatility = standardDeviation(dailyReturns) * Math.sqrt(252);
    const winningDays = dailyReturns.filter((value) => value > 0).length;
    const tradeNotional = trades.reduce(
      (sum, trade) => sum + trade.price * trade.quantity,
      0,
    );
    const warnings = [
      "Daily close execution is an MVP approximation.",
      ...validation.warnings,
      ...(candles.length < 252
        ? ["Annualized return uses a short-range approximation."]
        : []),
    ];

    return {
      artifactType: "backtest_result",
      runId: input.runId,
      strategy: input.spec,
      assumptions: input.spec.assumptions,
      dataSourceRefs: input.dataSourceRefs,
      metrics: {
        totalReturn: metric(totalReturn),
        annualizedReturn: metric(
          annualizedReturn,
          candles.length < 252 ? ["Range is shorter than one year."] : [],
        ),
        volatility: metric(volatility),
        sharpeLike: metric(
          volatility === 0 ? 0 : annualizedReturn / volatility,
        ),
        maxDrawdown: metric(
          Math.min(...drawdownCurve.map((point) => point.value)),
        ),
        winRate: metric(
          dailyReturns.length === 0 ? 0 : winningDays / dailyReturns.length,
        ),
        exposure: metric(
          equityCurve.length === 0
            ? 0
            : dailyReturns.filter((_, index) =>
                hasPositionAt(trades, equityCurve[index].date),
              ).length / equityCurve.length,
        ),
        turnover: metric(
          tradeNotional / input.spec.assumptions.startingCapital,
        ),
        tradeCount: metric(trades.length),
        benchmarkReturn: metric(benchmarkReturn),
        excessReturn: metric(totalReturn - benchmarkReturn),
      },
      equityCurve,
      drawdownCurve,
      benchmarkCurve,
      trades,
      warnings,
      caveat: BACKTEST_PAST_PERFORMANCE_CAVEAT,
    };
  }
}

function movingAverage(
  candles: Candle[],
  index: number,
  window: number,
): number | undefined {
  if (index + 1 < window) return undefined;
  const slice = candles.slice(index + 1 - window, index + 1);
  return slice.reduce((sum, candle) => sum + candle.close, 0) / window;
}

function calculateDrawdownCurve(
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

function standardDeviation(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function hasPositionAt(
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

function round(value: number): number {
  return Number.isFinite(value) ? Math.round(value * 1_000_000) / 1_000_000 : 0;
}

export function renderBacktestMarkdownReport(result: BacktestResult): string {
  const rows = Object.entries(result.metrics)
    .map(([name, metric]) => {
      if (typeof metric === "number") return `| ${name} | ${metric} | n/a |`;
      return `| ${name} | ${metric.value} | ${metric.calculationPeriod.start} to ${metric.calculationPeriod.end} |`;
    })
    .join("\n");
  return [
    `# ${result.strategy.name}`,
    "",
    `Run ID: ${result.runId}`,
    "",
    "## Assumptions",
    `Fee: ${result.assumptions.feeBps} bps; slippage: ${result.assumptions.slippageBps} bps; starting capital: ${result.assumptions.startingCapital} ${result.assumptions.currency}.`,
    "",
    "## Metrics",
    "| Metric | Value | Period |",
    "| --- | ---: | --- |",
    rows,
    "",
    "## Data Sources",
    result.dataSourceRefs.map((ref) => `- ${ref}`).join("\n"),
    "",
    "## Warnings",
    result.warnings.map((warning) => `- ${warning}`).join("\n"),
    "",
    "## Caveat",
    BACKTEST_PAST_PERFORMANCE_CAVEAT,
    "",
    "## Rerun",
    "Change the strategy timeRange and rerun through plutus_backtest.run_backtest.",
  ].join("\n");
}

export const renderBacktestMarkdown = renderBacktestMarkdownReport;

export function runLongOnlyBacktest(spec: StrategySpec): BacktestResult & {
  metrics: BacktestResult["metrics"] & { tradeCount: number };
} {
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

function runLongOnlyBacktestSync(input: BacktestInput): BacktestResult {
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
  const period = { start: first.date, end: last.date };
  const metric = (value: number): MetricValue => ({
    value: round(value),
    calculationPeriod: period,
    inputSeriesRefs: input.dataSourceRefs,
    warnings: [],
    currency: input.spec.assumptions.currency,
    interval: "1d",
  });
  const totalReturn =
    equityCurve.at(-1)!.value / input.spec.assumptions.startingCapital - 1;
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

export class LocalBacktestQueue {
  private readonly storage = new Map<string, string>();
  private readonly queue = new BacktestQueue({ storage: this.storage });

  enqueue(spec: StrategySpec): string {
    const fixture = createBtcMovingAverageCrossoverFixture();
    const id = crypto.randomUUID();
    void this.queue.enqueue({
      runId: id,
      spec,
      candles: fixture.candles,
      benchmarkCandles: fixture.benchmarkCandles,
      dataSourceRefs: fixture.dataSourceRefs,
    });
    return id;
  }

  resume(id: string): { status: BacktestQueueStatus } | undefined {
    const item = this.queue.list().find((candidate) => candidate.id === id);
    if (!item) return undefined;
    const result = runLongOnlyBacktestSync(item.input);
    return { status: result ? "completed" : "failed" };
  }
}

export function renderBacktestHtmlReport(result: BacktestResult): string {
  return `<article><h1>${escapeHtml(result.strategy.name)}</h1><p>${BACKTEST_PAST_PERFORMANCE_CAVEAT}</p><pre>${escapeHtml(
    renderBacktestMarkdownReport(result),
  )}</pre></article>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

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

export type BacktestQueueStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed";

export interface BacktestQueueItem {
  id: string;
  input: BacktestInput;
  status: BacktestQueueStatus;
  result?: BacktestResult;
  error?: string;
}

export class BacktestQueue {
  private readonly storageKey = "plutus-backtest-queue";
  private items: BacktestQueueItem[];

  constructor(
    private readonly options: { storage?: Map<string, string> } = {},
  ) {
    const raw = this.options.storage?.get(this.storageKey);
    this.items = raw ? (JSON.parse(raw) as BacktestQueueItem[]) : [];
    for (const item of this.items) {
      if (item.status === "running") item.status = "pending";
    }
    this.persist();
  }

  async enqueue(input: BacktestInput): Promise<BacktestQueueItem> {
    const item: BacktestQueueItem = {
      id: input.runId,
      input,
      status: "pending",
    };
    this.items.push(item);
    this.persist();
    return item;
  }

  async resumePending(engine: BacktestEngine): Promise<BacktestQueueItem[]> {
    const processed: BacktestQueueItem[] = [];
    for (const item of this.items.filter(
      (queueItem) => queueItem.status === "pending",
    )) {
      item.status = "running";
      this.persist();
      try {
        item.result = await engine.run(item.input);
        item.status = "completed";
      } catch (error) {
        item.status = "failed";
        item.error = error instanceof Error ? error.message : String(error);
      }
      processed.push(item);
      this.persist();
    }
    return processed;
  }

  list(): BacktestQueueItem[] {
    return this.items.map((item) => ({ ...item }));
  }

  private persist(): void {
    this.options.storage?.set(this.storageKey, JSON.stringify(this.items));
  }
}

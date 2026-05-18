# Plutus Spec: Backtesting And Reports

## 1. Goal

Specify MVP strategy generation, long-only backtesting, metrics, report artifacts, and the Phase 2 Shadow Account extension.

## 2. MVP Backtest Scope

Supported:

- single-asset crypto spot strategies;
- single-asset stock/ETF strategies;
- simple multi-asset long-only rebalancing strategies;
- daily or higher interval candles for MVP;
- fixed fee and slippage assumptions;
- benchmark comparison;
- deterministic report generation.
- locale-aware report rendering from canonical result data.
- app-local execution without Redis or a hosted job runner.

Not supported in MVP:

- live trading;
- shorting;
- leverage;
- derivatives;
- intraday high-frequency strategies;
- options/futures/forex;
- walk-forward or Monte Carlo validation.

## 3. Strategy Spec

`packages/backtest/src/strategy-spec.ts` should define:

```ts
export const StrategySpecSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  assetUniverse: z.array(z.object({
    instrumentId: z.string().uuid(),
    role: z.enum(["primary", "benchmark", "rotation_candidate"]),
  })).min(1),
  timeRange: z.object({
    start: z.string().date(),
    end: z.string().date(),
  }),
  entryRules: z.array(z.object({
    type: z.enum(["moving_average_cross", "threshold", "rebalance_schedule"]),
    params: z.record(z.string(), z.unknown()),
    description: z.string(),
  })),
  exitRules: z.array(z.object({
    type: z.enum(["moving_average_cross", "stop_loss", "time_exit", "rebalance_schedule"]),
    params: z.record(z.string(), z.unknown()),
    description: z.string(),
  })),
  positionSizing: z.object({
    mode: z.enum(["full_notional", "fixed_weight", "equal_weight", "cash_buffer"]),
    params: z.record(z.string(), z.unknown()),
  }),
  riskRules: z.array(z.object({
    type: z.enum(["max_position_weight", "max_drawdown_stop", "cash_minimum"]),
    params: z.record(z.string(), z.unknown()),
    description: z.string(),
  })),
  requiredData: z.array(z.object({
    instrumentId: z.string().uuid(),
    interval: z.enum(["1d", "1wk", "1mo"]),
    fields: z.array(z.enum(["open", "high", "low", "close", "volume", "adjusted_close"])),
  })),
  benchmarkId: z.string(),
  assumptions: z.object({
    feeBps: z.number().min(0),
    slippageBps: z.number().min(0),
    startingCapital: z.number().positive(),
    currency: z.string().length(3),
  }),
  validationPlan: z.array(z.string()),
});
```

## 4. Backtest Engine Interface

Implementation location:

```text
packages/backtest/src/
  engine/
    backtest-engine.ts
    long-only-engine.ts
    portfolio-rebalance-engine.ts
  metrics/
    returns.ts
    drawdown.ts
    risk-adjusted.ts
    turnover.ts
  reports/
    report-model.ts
    markdown-renderer.ts
    html-renderer.ts
```

Interface:

```ts
export interface BacktestEngine {
  validate(spec: StrategySpec): Promise<BacktestValidationResult>;
  run(input: BacktestInput): Promise<BacktestResult>;
}
```

`BacktestInput` includes:

- strategy spec;
- normalized candle dataset refs;
- benchmark series ref;
- assumptions;
- run ID.

## 5. Metrics

MVP metrics:

- total return;
- annualized return when range is long enough;
- volatility;
- Sharpe-like risk-adjusted return;
- max drawdown;
- win rate;
- exposure;
- turnover;
- trade count;
- benchmark return;
- excess return versus benchmark.

Every metric response must include:

- calculation period;
- input series refs;
- warnings for insufficient data;
- currency and interval assumptions.

## 6. Report Model

Backtest reports produce:

- summary;
- strategy rules;
- assumptions;
- data sources;
- metric table;
- equity curve chart data;
- drawdown chart data;
- benchmark comparison;
- warning list;
- past-performance disclaimer;
- rerun instructions.

Reports receive an explicit report locale and number/date formatting locale. Renderers localize labels, explanatory copy, dates, numbers, currencies, and time zones, but they keep strategy IDs, instrument symbols, source refs, metric keys, and audit refs unchanged so the artifact can be reproduced and verified.

Artifact types:

- `strategy_spec`
- `backtest_result`
- `chart_json`
- `report_markdown`
- `report_html`

## 7. Agent Flow

1. User asks for a strategy or backtest.
2. Orchestrator selects `quant_strategy_desk`.
3. Market data researcher resolves instruments and data availability.
4. Quant strategy researcher creates a `StrategySpec`.
5. `plutus_backtest.validate_strategy_spec` validates support.
6. If valid, `plutus_backtest.run_backtest` executes immediately or records an app-local SQLite queue item for the MVP engine.
7. Risk manager reviews assumptions, data limits, and result interpretation.
8. Report writer publishes run card and backtest report.

## 8. Safety Rules

- Default all generated strategies to simulation only.
- Reject or warn on leverage, shorting, derivatives, illiquid instruments, and unsupported intervals.
- Include this report caveat in every backtest artifact: "Past performance does not guarantee future results."
- Generated strategy code, if introduced later, runs only in a sandboxed workspace.
- Backtest results must not be converted into trade orders in MVP.
- Localized report text must not imply different market coverage, currency support, tax treatment, or jurisdiction-specific advice.

## 9. Phase 2 Shadow Account

Add these entities:

- `TradeImport`
- `Trade`
- `ShadowRuleCandidate`
- `ShadowAccountReport`

CSV parser input fields:

- date;
- symbol;
- side;
- quantity;
- price;
- fees;
- currency;
- notes.

Diagnostics:

- holding period;
- win rate;
- realized PnL;
- drawdown;
- turnover;
- overtrading;
- early exits;
- repeated loss clusters;
- concentration spikes.

The Shadow Account report compares actual behavior with a rule-based replay when sufficient data exists. If data is insufficient, the report must explain why no replay was run.

## 10. Acceptance Tests

- A BTC 20/50 moving-average crossover request produces a valid strategy spec.
- The same spec can be rerun with a different date range.
- A backtest result includes metrics, chart data, assumptions, data source refs, fee/slippage, and warnings.
- A leverage strategy request is rejected or marked with enhanced risk warning.
- The report artifact includes the past-performance caveat.
- The same canonical backtest result can render English and Korean report artifacts with identical metric values and source refs.

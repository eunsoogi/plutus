# Plutus PRD: Strategy, Backtesting, And Shadow Account

## 1. Objective

Allow users to convert investment ideas and trading behavior into testable strategies, run simulations, and compare actual decisions against rule-based alternatives.

## 2. Strategy Generation

Users must be able to describe an idea in natural language:

- "Backtest a BTC 20/50 moving average crossover in 2024."
- "Check whether NVDA pullbacks to the 50-day moving average have worked after earnings."
- "Create a simple ETF rotation strategy between QQQ, SPY, and TLT."

The Quant Strategy Agent must convert the request into:

- Strategy name.
- Asset universe.
- Time range.
- Entry rules.
- Exit rules.
- Position sizing rules.
- Risk rules.
- Required data.
- Backtest engine target.
- Validation plan.

## 3. Backtesting Requirements

MVP backtesting must support:

- Single-asset crypto spot strategy.
- Single-asset equity/ETF strategy.
- Multi-asset portfolio rebalancing strategy.
- Long-only strategies.
- Fees and slippage assumptions.
- Benchmark comparison.
- Return, volatility, Sharpe-like risk-adjusted return, max drawdown, win rate, exposure, and turnover.
- Exportable HTML or Markdown report.
- Run card containing inputs, assumptions, version, data source, warnings, and artifacts.

Post-MVP backtesting:

- Walk-forward validation.
- Bootstrap confidence intervals.
- Monte Carlo resampling.
- Regime-based performance breakdown.
- Shorting, leverage, options, and futures support.

## 4. Shadow Account

Borrow Vibe-Trading's Shadow Account idea for personal discipline analysis. Plutus should let users import or manually enter trades, then compare actual behavior with a rule-based shadow strategy.

Phase 2 behavior:

- Upload or manually enter trade history.
- Parse date, symbol, side, quantity, price, fees, and notes.
- Summarize holding period, win rate, realized PnL, drawdown, and turnover.
- Detect basic behavioral patterns: overtrading, early exits, revenge trades from repeated loss clusters, and concentration spikes.
- Extract candidate rules from repeated behavior.
- Backtest or replay a shadow strategy where possible.
- Produce a report showing actual path versus rule-based path.

## 5. Strategy Safety Requirements

- Generated strategies must default to simulation only.
- Any strategy with leverage, shorting, derivatives, or illiquid assets must trigger additional risk warnings.
- If generated strategy code is introduced after MVP, it must run in a sandboxed environment.
- Reports must clearly show assumptions and data limitations.
- Agents must not present backtest performance as a guarantee.

## 6. Acceptance Criteria

MVP:

- User can ask for a BTC moving-average backtest and receive metrics, chart data, assumptions, and a report artifact.
- User can save a generated strategy spec and rerun it later with a different date range.
- Backtest output includes data source, fee/slippage assumptions, and risk warnings.

Phase 2:

- User can upload a simple CSV of trades and receive a Shadow Account behavior report.

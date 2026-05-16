# Plutus PRD: Agent Team Requirements

## 1. Objective

Build an agent team that behaves like a personal investment desk for crypto and stock management. The team must decompose user intent, gather market context, run specialist analysis, debate conclusions, validate risk, and return an auditable decision package.

## 2. Agent Architecture

Use a manager-style Codex orchestration model for MVP. Plutus should expose product-level agent team presets, while the implementation uses Codex SDK threads, Codex subagent prompts, project-scoped custom agents, MCP tools, and structured outputs.

- Orchestrator Agent: runs as the root Codex thread. It parses user intent, selects workflow, asks Codex to spawn or invoke specialist custom agents, and merges final output.
- Market Data Agent: resolves symbols, markets, timeframes, prices, OHLCV, fundamentals, and crypto market data.
- Equity Analyst Agent: analyzes US/global equities, fundamentals, earnings, valuation, sector context, and news.
- Crypto Analyst Agent: analyzes spot crypto, exchange market data, funding/basis where available, liquidity, and on-chain inputs in later phases.
- Quant Strategy Agent: translates ideas into testable strategy specs and backtest jobs.
- Technical Analysis Agent: handles indicators, patterns, trend/range state, support/resistance, and regime summaries.
- Portfolio Manager Agent: evaluates allocation, concentration, drift, rebalancing candidates, and cash/stablecoin exposure.
- Risk Manager Agent: checks drawdown, volatility, correlation, liquidity, leverage, position sizing, and scenario stress.
- Report Agent: produces final run cards, user-facing reports, mobile summaries, and export artifacts.

## 3. Workflow Contract

Every multi-agent run follows this sequence:

1. Plan: classify request, identify required agents, tools, data, and validation level.
2. Ground: fetch relevant market data, user portfolio state, watchlists, documents, and prior memory.
3. Execute: run specialist analyses, generate strategy specs, and call backtest or portfolio tools.
4. Debate: compare bull, bear, quant, and risk viewpoints for material decisions.
5. Validate: run risk checks, data freshness checks, benchmark comparisons, and artifact consistency checks.
6. Deliver: return a final decision package with confidence, caveats, citations, and next actions.

## 4. Preset Teams

MVP must include these preset teams:

- Investment Committee: `equity_analyst` bull pass, `equity_analyst` bear pass, `technical_analyst`, `portfolio_manager`, `risk_manager`, `report_writer`.
- Crypto Research Desk: `crypto_analyst`, `technical_analyst`, `quant_strategy_researcher`, `risk_manager`, `report_writer`.
- Quant Strategy Desk: `market_data_researcher`, `quant_strategy_researcher`, `risk_manager`, `report_writer`.
- Technical Analysis Panel: `market_data_researcher`, `technical_analyst`, `risk_manager`, `report_writer`.
- Portfolio Review Committee: `market_data_researcher`, `portfolio_manager`, `risk_manager`, `report_writer`.

Post-MVP presets:

- Earnings Research Desk.
- Macro Rates FX Desk.
- Global Allocation Committee.
- Shadow Account Review Team.

## 5. Agent Output Requirements

Each agent output must include:

- Role and scope.
- Inputs used.
- Key observations.
- Confidence level.
- Data freshness.
- Known limitations.
- Recommended next tool call or decision.

The final output must include:

- Plain-language summary.
- Recommendation category: observe, research more, rebalance candidate, strategy candidate, risk warning, or no-action.
- Supporting evidence.
- Dissenting views.
- Risk checklist.
- Artifacts generated.
- User approval requirement for any irreversible action.

## 6. TypeScript Codex SDK Requirements

Use the TypeScript OpenAI Codex SDK as the primary agent-control layer:

- `@openai/codex-sdk` in the macOS host local agent runtime.
- One Codex thread per user-facing research run.
- Role-scoped prompts for each specialist agent inside the run plan.
- Repeated `thread.run()` calls for plan, specialist work, debate, validation, and final reporting stages.
- `runStreamed()` for progress events, intermediate items, file-change notifications, macOS live status, and mobile remote-control status forwarded by the Mac host.
- `resumeThread(threadId)` for long-running research and macOS host app restarts.
- JSON-schema structured output for run plans, specialist findings, risk reviews, strategy specs, and final run cards.
- Zod schemas converted to OpenAI-compatible JSON Schema for runtime validation.
- Working-directory controls so Codex operates inside a per-run Git workspace.
- Codex CLI `config` and `env` controls to enforce sandbox, model, approval, network, and secret boundaries.
- Local stdio MCP adapter configuration for market data, portfolio, backtest, report, and document tools when those tools need to be callable by Codex. The adapter runs on the Mac host and delegates to the same local tool router used by the app.
- Project-scoped custom agents in `.codex/agents/` for finance specialist roles.
- Native Codex subagent workflows for parallel specialist work when determinism requirements allow.
- Plutus-orchestrated multi-thread execution as a strict deterministic mode for workflows that need per-agent retries, budgets, or database records.

Plutus should model specialist "agents" as Codex-controlled role runs and workflow stages inside the Codex SDK execution model.

## 7. Codex Custom Agent Requirements

Each specialist role must have a project-scoped custom agent file:

- `.codex/agents/market-data-researcher.toml`
- `.codex/agents/equity-analyst.toml`
- `.codex/agents/crypto-analyst.toml`
- `.codex/agents/quant-strategy-researcher.toml`
- `.codex/agents/technical-analyst.toml`
- `.codex/agents/portfolio-manager.toml`
- `.codex/agents/risk-manager.toml`
- `.codex/agents/report-writer.toml`

Each custom agent must define `name`, `description`, and `developer_instructions`. Role-specific files may also define model, reasoning effort, sandbox mode, local tool namespaces, and skills configuration.

Each custom agent must also declare an explicit local tool allowlist. Use [Agent MCP Map](./09-agent-mcp-map.md) as the source of truth for which local tool namespaces and write capabilities each role receives.

## 8. Acceptance Criteria

- A user can ask: "BTC and NVDA exposure together looks risky. Review my portfolio and suggest what to inspect."
- The orchestrator selects Portfolio Review Committee.
- The root Codex thread asks Codex to use the relevant custom agents or executes specialist Codex threads through `CodexRunHost`.
- The system fetches portfolio positions, current market data, historical returns, and correlation.
- The risk manager can veto weak recommendations.
- The final answer contains a no-action/research/rebalance category, citations, and a risk summary.
- The run is saved in the macOS host app and visible/controllable from mobile through the paired remote-control session.

# Plutus PRD: Product Vision

## 1. Summary

Plutus is a multi-agent portfolio workspace for managing crypto and stock research, portfolio decisions, simulations, and personal trading discipline. The product should feel like a small investment desk: the user asks a natural-language question, specialist agents gather evidence, debate, validate, and return an inspectable recommendation package.

The product should borrow the strongest ideas from HKUDS/Vibe-Trading while being designed as a TypeScript-first product using the OpenAI Codex SDK as the agent-control layer. Vibe-Trading frames itself as an open-source research workspace that connects natural-language prompts to market-data loaders, strategy generation, backtest engines, reports, exports, and persistent research memory. It explicitly focuses on research, simulation, and backtesting rather than live execution. Plutus should keep the same safety boundary for MVP.

## 2. Product Goals

- Manage crypto and stock portfolios from one agent-assisted workspace.
- Turn natural-language requests into structured research runs, strategy drafts, portfolio analysis, and backtest reports.
- Provide multi-agent teams for investment, quant, crypto, macro, technical analysis, and risk workflows.
- Support macOS and mobile apps from the beginning with a shared TypeScript domain layer.
- Preserve the user's preferences, watchlists, strategies, research notes, and prior decisions across sessions.
- Produce auditable outputs: data sources, tool traces, assumptions, decision rationale summaries, risk checks, and generated artifacts.

## 3. Non-Goals For MVP

- No direct live trading execution.
- No promise of financial advice, guaranteed returns, or autonomous capital allocation.
- No high-frequency trading or latency-sensitive execution.
- No support for every global exchange at launch.
- No unverified social-sentiment trading signal as a primary decision driver.

## 4. Target Users

- Individual investors managing a mixed stock and crypto portfolio.
- Technical users who want agent-assisted research, simulations, and strategy generation.
- Power users who want reusable workflows similar to a personal research desk.
- Future users who may later connect broker/exchange accounts for read-only portfolio sync.

## 5. Core Product Principles

- Evidence before opinion: every agent output must cite the market data, document, tool result, or assumption it used.
- Debate before decision: major recommendations should pass through specialist disagreement and risk review.
- Simulation before action: strategy outputs must be backtestable and reportable before any future execution feature.
- Human final control: the user always approves portfolio decisions and any future trade execution.
- Multi-platform consistency: macOS and mobile must expose the same run history, watchlists, portfolios, and reports.

## 6. Vibe-Trading Concepts To Adopt

- Plan, ground, execute, validate, deliver workflow.
- Specialist finance skill library split by data source, strategy, analysis, asset class, crypto, flow, tooling, and risk.
- Preset research teams such as investment committee, global equities desk, crypto research desk, quant strategy desk, technical analysis panel, and risk committee.
- Cross-market data and composite backtesting across stocks and crypto.
- Persistent memory and reusable workflows.
- Shadow-account concept for comparing user behavior against extracted rule-based strategies.
- Run cards and persisted artifacts for reproducibility.
- Exportable reports and strategy code, with live trading excluded from MVP.

## 7. Success Metrics

- First useful research run completed in under 5 minutes after onboarding.
- At least 90% of agent recommendations include data-source provenance and a risk summary.
- At least 80% of generated strategies produce a runnable backtest artifact or a clear validation failure.
- User can open the same research run on macOS and mobile with identical state.
- User can create, track, and review at least one portfolio, one watchlist, and one strategy without manual file editing.

## 8. Source Notes

- HKUDS/Vibe-Trading README, accessed 2026-05-16: research workspace, no live execution, research workflow, skill library, swarm presets, provider failover, and run-card concepts.
- OpenAI Codex SDK docs, accessed 2026-05-17: TypeScript package `@openai/codex-sdk`, local Codex thread control, repeated `run()` calls, resumable thread IDs, structured output, streamed events, working-directory controls, and Codex CLI environment/config overrides.

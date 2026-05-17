# Plutus PRD: Agent MCP Map

## 1. Objective

Define the local tool namespaces available to each Codex custom agent.

The goal is to give each specialist enough capability to do its job while limiting private data exposure, prompt-injection blast radius, and accidental write access.

Codex reaches these tools through a Mac-hosted stdio MCP adapter that delegates to the local tool router; no hosted backend or network MCP service is required.

## 2. Local Tool Strategy

Plutus should provide first-party local domain tools instead of giving agents broad database, filesystem, or external API access.

These names are logical tool namespaces. MVP implements the tools in `@plutus/local-tools` and exposes approved namespaces to Codex through `@plutus/local-mcp-adapter` over stdio.

MVP local tool namespaces:

- `plutus_market_data`: symbols, quotes, OHLCV, benchmark data, provider freshness, and corporate actions.
- `plutus_portfolio`: user portfolios, positions, watchlists, notes, allocation snapshots, and read-only portfolio analytics.
- `plutus_backtest`: strategy spec validation, backtest execution, metrics, benchmark comparison, and artifact lookup.
- `plutus_risk`: concentration, correlation, volatility, drawdown, liquidity, leverage, and scenario checks.
- `plutus_research`: web/document/news retrieval through sanitized readers and citation-safe summaries.
- `plutus_reports`: run card creation, report rendering, chart artifact registration, and mobile summary generation.
- `plutus_memory`: user preferences, saved theses, prior research runs, strategy library, and audit-safe recall.
- `plutus_wiki`: local wiki page search, read, autonomous page maintenance, contradiction checks, revision history, and revert support.
- `plutus_audit`: immutable event logging, tool-call provenance, warning registration, and compliance flags.

Post-MVP local tool namespaces:

- `plutus_broker_readonly`: read-only broker/exchange account import after security review.
- `plutus_onchain`: wallet and on-chain analytics.
- `plutus_options`: options chains, Greeks, implied volatility, and options strategy simulation.
- `plutus_notifications`: push/email/in-app notification scheduling.

## 3. Local Tool Permission Principles

- Default to read-only tools for analyst agents.
- Only `report_writer` can create final user-facing report artifacts.
- Only `quant_strategy_researcher` can request new backtest runs.
- Only `risk_manager` can register risk vetoes.
- No MVP local tool may place live trades or submit broker/exchange orders.
- Agents must receive derived portfolio context where possible instead of full raw account history.
- Tools must return source metadata, timestamps, provider names, and freshness warnings.
- Tools must validate all inputs with Zod and reject unknown symbols, unsupported markets, and unsafe file paths.

## 4. Local Tool Inventory

### `plutus_market_data`

- `search_instruments(query, assetTypes, regions)`: resolve tickers, coins, ETFs, and canonical instrument IDs.
- `get_quote(instrumentId)`: latest quote with provider, timestamp, delay status, and currency.
- `get_ohlcv(instrumentId, interval, start, end, providerPreference)`: normalized candles.
- `get_benchmark_series(benchmarkId, start, end)`: benchmark series for SPY, QQQ, BTC, ETH, or custom blend.
- `get_corporate_actions(instrumentId, start, end)`: splits/dividends where available.
- `get_market_status(market)`: open/closed/session metadata.
- `get_provider_health()`: provider availability, latency, quota, and freshness.

### `plutus_portfolio`

- `list_portfolios()`: portfolio metadata for the active Mac-host profile only.
- `get_portfolio_snapshot(portfolioId, asOf)`: positions, cash, and allocation snapshot.
- `get_position_history(portfolioId, instrumentId, start, end)`: position changes and cost basis history.
- `get_watchlists()`: watchlist metadata and items for the active Mac-host profile only.
- `get_instrument_notes(instrumentId, portfolioId)`: user notes and thesis snippets.
- `compute_allocation(portfolioId, groupBy)`: allocation by asset class, sector/category, currency, account, or tag.
- `compute_performance(portfolioId, start, end, benchmarkId)`: portfolio return and benchmark comparison.

### `plutus_backtest`

- `validate_strategy_spec(strategySpec)`: schema and feasibility validation.
- `run_backtest(strategySpec, datasetRef, assumptions)`: execute simulation job. This tool is restricted to `quant_strategy_researcher`.
- `get_backtest_result(backtestRunId)`: metrics, charts, warnings, and artifact IDs.
- `compare_backtests(backtestRunIds, benchmarkId)`: compare multiple runs.
- `register_strategy_spec(strategySpec)`: save a reusable strategy spec. This tool is restricted to `quant_strategy_researcher`.
- `get_strategy_spec(strategyId)`: retrieve a saved strategy.

### `plutus_risk`

- `compute_correlation(instrumentIds, start, end, interval)`: cross-asset correlation matrix.
- `compute_volatility(instrumentIdOrPortfolioId, start, end)`: realized volatility and rolling volatility.
- `compute_drawdown(seriesRef)`: max drawdown and drawdown periods.
- `check_concentration(portfolioId, limits)`: concentration by asset, category, currency, and account.
- `check_liquidity(instrumentIds, orderSizeAssumptions)`: liquidity and slippage warnings.
- `run_scenario(portfolioId, scenario)`: stress test portfolio under market shocks.
- `register_risk_veto(runId, reason, severity, evidenceRefs)`: record a blocking risk decision. This tool is restricted to `risk_manager`.

### `plutus_research`

- `web_search(query, recency, domains)`: controlled web search for market context.
- `read_url(url)`: sanitized URL reader with prompt-injection warnings.
- `read_document(documentId)`: sanitized document reader for uploaded PDFs, CSVs, statements, and reports.
- `search_filings(instrumentId, filingTypes, start, end)`: SEC/issuer filing lookup where provider supports it.
- `get_news(instrumentId, start, end, providerPreference)`: news headlines and source metadata.
- `summarize_sources(sourceRefs, purpose)`: citation-preserving source summary.

### `plutus_reports`

- `create_run_card(runId, payload)`: create reproducible run card. This tool is restricted to `report_writer`.
- `render_report(runId, format, sections)`: render Markdown/HTML/PDF report artifact. This tool is restricted to `report_writer`.
- `create_chart_artifact(runId, chartSpec)`: create chart artifact for webview/mobile rendering. This tool is restricted to `report_writer`.
- `create_mobile_summary(runId, payload)`: create compact mobile summary. This tool is restricted to `report_writer`.
- `register_artifact(runId, artifact)`: attach generated files to a research run. This tool is restricted to `report_writer`.

### `plutus_memory`

- `recall_user_preferences(scope)`: preferences such as risk tolerance, default benchmarks, and excluded assets.
- `recall_prior_runs(query, filters)`: semantically search past research runs for the active profile.
- `recall_saved_theses(instrumentIds)`: retrieve saved theses and notes.
- `capture_research_memory(memory, sourceRefs, capturePolicy)`: automatically save durable memory through the Plutus memory adapter.
- `update_research_memory(memoryId, patch)`: edit or reclassify an existing memory.
- `archive_research_memory(memoryId, reason)`: archive memory without deleting its audit trail.
- `forget_research_memory(memoryId)`: remove memory at user request.

The backing implementation should use Mem0 through `packages/memory`, while the tool contract remains Plutus-owned for audit, retention, sensitivity, and deletion semantics.

`plutus_memory` stores atomic recall records and wiki pointers. It must not store full wiki page bodies.

### `plutus_wiki`

- `search_wiki(query, filters)`: search local wiki pages and metadata.
- `get_wiki_page(pageId)`: read a wiki page with source links and freshness metadata.
- `create_wiki_page(page, sourceRefs)`: create a wiki page with source links and revision metadata.
- `update_wiki_page(pageId, patch, sourceRefs, revisionNote)`: update an existing wiki page.
- `merge_wiki_pages(sourcePageIds, targetPage, sourceRefs)`: consolidate duplicated or overlapping pages.
- `archive_wiki_page(pageId, reason)`: archive an obsolete page.
- `revert_wiki_revision(pageId, revisionId, reason)`: restore a previous revision at user or system request.
- `find_wiki_contradictions(sourceRefs, candidateClaims)`: compare proposed claims against existing wiki pages.

In MVP, `plutus_wiki` is an autonomous maintenance workflow. Wiki writes do not require pre-approval, but every write must include source links, revision notes, audit events, and user-visible revert support.

### `plutus_audit`

- `log_agent_event(runId, agentName, eventType, payloadRef)`: append audit event.
- `log_tool_provenance(runId, toolName, inputHash, outputHash, sourceRefs)`: record tool provenance.
- `register_warning(runId, warningType, severity, message, evidenceRefs)`: record data, risk, or compliance warning.
- `get_run_audit_trail(runId)`: retrieve immutable audit timeline.

## 5. Agent-To-Tool Mapping

| Agent | Required Tool Namespaces | Optional Tool Namespaces | Write Capabilities |
| --- | --- | --- | --- |
| Orchestrator | `plutus_memory`, `plutus_audit` | `plutus_market_data`, `plutus_portfolio`, `plutus_research` | Can create run plan events only |
| Market Data Researcher | `plutus_market_data`, `plutus_audit` | `plutus_research` | Can register data warnings only |
| Equity Analyst | `plutus_market_data`, `plutus_research`, `plutus_audit` | `plutus_memory`, `plutus_portfolio` | Read-only except analysis event logs |
| Crypto Analyst | `plutus_market_data`, `plutus_research`, `plutus_audit` | `plutus_memory`, post-MVP `plutus_onchain` | Read-only except analysis event logs |
| Technical Analyst | `plutus_market_data`, `plutus_risk`, `plutus_audit` | None | Can propose chart specs in structured output; cannot publish artifacts |
| Quant Strategy Researcher | `plutus_market_data`, `plutus_backtest`, `plutus_risk`, `plutus_audit` | `plutus_memory` | Can register strategy specs and request backtests |
| Portfolio Manager | `plutus_portfolio`, `plutus_market_data`, `plutus_risk`, `plutus_memory`, `plutus_audit` | None | Read-only portfolio access; can register allocation recommendations |
| Risk Manager | `plutus_risk`, `plutus_portfolio`, `plutus_market_data`, `plutus_audit` | `plutus_backtest`, `plutus_memory` | Can register risk warnings and vetoes |
| Report Writer | `plutus_reports`, `plutus_audit`, `plutus_memory` | `plutus_market_data`, `plutus_portfolio`, `plutus_backtest`, `plutus_risk` through artifact/result IDs only | Can create run cards, report artifacts, and mobile summaries |
| LLM Wiki Curator | `plutus_memory`, `plutus_wiki`, `plutus_reports`, `plutus_audit` | `plutus_research` through source/result IDs only | Can capture wiki pointer memories and create, update, merge, archive, and cross-link wiki pages; cannot make portfolio recommendations |

## 6. Preset Team Tool Bundles

### Portfolio Review Committee

- Agents: `portfolio_manager`, `market_data_researcher`, `risk_manager`, `report_writer`.
- Tool namespaces: `plutus_portfolio`, `plutus_market_data`, `plutus_risk`, `plutus_memory`, `plutus_reports`, `plutus_audit`.
- Required final checks: allocation, concentration, correlation, data freshness, recommendation category.

### Investment Committee

- Agents: `equity_analyst`, `technical_analyst`, `portfolio_manager`, `risk_manager`, `report_writer`.
- Tool namespaces: `plutus_market_data`, `plutus_research`, `plutus_portfolio`, `plutus_risk`, `plutus_memory`, `plutus_reports`, `plutus_audit`.
- Required final checks: bull case, bear case, technical regime, portfolio impact, risk veto.

### Crypto Research Desk

- Agents: `crypto_analyst`, `technical_analyst`, `quant_strategy_researcher`, `risk_manager`, `report_writer`.
- Tool namespaces: `plutus_market_data`, `plutus_research`, `plutus_backtest`, `plutus_risk`, `plutus_reports`, `plutus_audit`.
- Required final checks: liquidity, volatility, exchange/provider caveats, strategy assumptions, drawdown risk.

### Quant Strategy Desk

- Agents: `market_data_researcher`, `quant_strategy_researcher`, `risk_manager`, `report_writer`.
- Tool namespaces: `plutus_market_data`, `plutus_backtest`, `plutus_risk`, `plutus_reports`, `plutus_audit`, optional `plutus_memory`.
- Required final checks: strategy spec validation, backtest assumptions, benchmark comparison, overfitting warning.

### Technical Analysis Panel

- Agents: `technical_analyst`, `market_data_researcher`, `risk_manager`, `report_writer`.
- Tool namespaces: `plutus_market_data`, `plutus_risk`, `plutus_reports`, `plutus_audit`.
- Required final checks: trend, momentum, volatility, support/resistance, invalidation level.

### Shadow Account Review Team

- Agents: `quant_strategy_researcher`, `portfolio_manager`, `risk_manager`, `report_writer`.
- Tool namespaces: `plutus_portfolio`, `plutus_market_data`, `plutus_backtest`, `plutus_risk`, `plutus_reports`, `plutus_research`, `plutus_audit`.
- Required final checks: parsed trade quality, behavior diagnostics, shadow rule extraction, replay/backtest assumptions.

### Knowledge Curation Desk

- Agents: `llm_wiki_curator`, `report_writer`.
- Tool namespaces: `plutus_memory`, `plutus_wiki`, `plutus_reports`, `plutus_research`, `plutus_audit`.
- Required final checks: source run links, memory capture policy, contradiction scan, freshness notes, revision note, and audit event.

## 7. Custom Agent Local MCP Adapter Examples

### `.codex/agents/risk-manager.toml`

```toml
name = "risk_manager"
description = "Risk specialist for drawdown, volatility, concentration, liquidity, leverage, and veto decisions."
model_reasoning_effort = "high"
sandbox_mode = "read-only"

developer_instructions = """
Act as the final risk gate for Plutus research runs.
Prioritize downside, data quality, liquidity, concentration, leverage, and correlation risks.
You may register risk warnings and vetoes, but you must not recommend live trade execution.
"""

[mcp_servers.plutus_risk]
command = "pnpm"
args = ["--filter", "@plutus/local-mcp-adapter", "start", "plutus_risk", "--stdio"]

[mcp_servers.plutus_portfolio]
command = "pnpm"
args = ["--filter", "@plutus/local-mcp-adapter", "start", "plutus_portfolio", "--read-only", "--stdio"]

[mcp_servers.plutus_market_data]
command = "pnpm"
args = ["--filter", "@plutus/local-mcp-adapter", "start", "plutus_market_data", "--read-only", "--stdio"]

[mcp_servers.plutus_audit]
command = "pnpm"
args = ["--filter", "@plutus/local-mcp-adapter", "start", "plutus_audit", "--stdio"]
```

### `.codex/agents/quant-strategy-researcher.toml`

```toml
name = "quant_strategy_researcher"
description = "Converts natural-language strategy ideas into testable strategy specs and backtest requests."
model_reasoning_effort = "high"
sandbox_mode = "workspace-write"

developer_instructions = """
Create explicit, testable strategy specs.
State entry, exit, sizing, risk, data, benchmark, fee, and slippage assumptions.
Never treat backtest results as guarantees.
"""

[mcp_servers.plutus_market_data]
command = "pnpm"
args = ["--filter", "@plutus/local-mcp-adapter", "start", "plutus_market_data", "--read-only", "--stdio"]

[mcp_servers.plutus_backtest]
command = "pnpm"
args = ["--filter", "@plutus/local-mcp-adapter", "start", "plutus_backtest", "--stdio"]

[mcp_servers.plutus_risk]
command = "pnpm"
args = ["--filter", "@plutus/local-mcp-adapter", "start", "plutus_risk", "--stdio"]

[mcp_servers.plutus_audit]
command = "pnpm"
args = ["--filter", "@plutus/local-mcp-adapter", "start", "plutus_audit", "--stdio"]
```

## 8. Acceptance Criteria

- Every custom agent has an explicit local stdio MCP adapter allowlist.
- No analyst agent receives broad database or filesystem access.
- Portfolio tools are read-only for all MVP agents.
- Backtest execution is available only to `quant_strategy_researcher` and risk validation flows.
- Risk veto registration is available only to `risk_manager`.
- Report artifact publication is available only to `report_writer`.
- Memory and wiki maintenance are autonomous, source-linked, audited, versioned where applicable, and user-editable or reversible.
- Every local tool response includes source metadata, timestamp, and warning fields where applicable.
- The Orchestrator can select a team preset and pass only that preset's tool bundle to Codex.

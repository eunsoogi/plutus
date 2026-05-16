# Plutus Spec: Local Tool Surface

## 1. Goal

Define the first-party local tool namespaces, MCP-shaped tool contracts, authorization model, and agent allowlists that Codex specialist agents use to access Plutus product capabilities.

## 2. Local Tool Router And Adapter Shape

MVP implementation has two packages:

- `@plutus/local-tools`: in-process local tool router used by the app.
- `@plutus/local-mcp-adapter`: stdio MCP adapter used by Codex. It exposes approved local tool namespaces and delegates calls to the router.

```text
packages/local-tools/src/
  index.ts
  router.ts
  context.ts
  authz/
    agent-allowlists.ts
    tool-permissions.ts
  namespaces/
    market-data.ts
    portfolio.ts
    backtest.ts
    risk.ts
    research.ts
    reports.ts
    memory.ts
    audit.ts
  schemas/
  audit/
```

```text
packages/local-mcp-adapter/src/
  index.ts
  stdio-server.ts
  namespace-registry.ts
  run-context.ts
```

Runtime invocation for adapter tests:

```bash
pnpm --filter @plutus/local-mcp-adapter test plutus_market_data --read-only
```

The adapter receives signed run context from the local Tauri runtime, not arbitrary user IDs from agent prompts.

## 3. Common Tool Response Envelope

Every local tool response must use this envelope:

```ts
export const LocalToolResponseSchema = z.object({
  ok: z.boolean(),
  data: z.unknown().optional(),
  sourceRefs: z.array(z.object({
    id: z.string(),
    provider: z.string(),
    title: z.string().optional(),
    url: z.string().url().optional(),
    asOf: z.string().datetime().optional(),
    retrievedAt: z.string().datetime(),
  })),
  warnings: z.array(z.object({
    code: z.string(),
    severity: z.enum(["info", "warning", "blocking"]),
    message: z.string(),
    evidenceRefs: z.array(z.string()).default([]),
  })),
  auditRef: z.string(),
});
```

Failures must also use the envelope with `ok: false` and a warning entry. Tools must not leak stack traces to agents.

## 4. Authorization Model

Input context:

```ts
export interface LocalToolRunContext {
  runId: string;
  profileId: string;
  agentName: string;
  selectedTeam: string;
  allowedNamespaces: string[];
  allowedTools: string[];
  writeScopes: string[];
}
```

Rules:

- Reject when `agentName` is unknown.
- Reject when namespace is not in `allowedNamespaces`.
- Reject write tools unless a matching `writeScopes` entry exists.
- Reject any tool that tries to access a portfolio/run outside the active local profile.
- Log every accepted and rejected tool call through `plutus_audit`.

## 5. Namespace Tool Contracts

### `plutus_market_data`

Read-only except data warning registration through audit.

Tools:

- `search_instruments(query, assetTypes, regions)`
- `get_quote(instrumentId)`
- `get_ohlcv(instrumentId, interval, start, end, providerPreference)`
- `get_benchmark_series(benchmarkId, start, end)`
- `get_corporate_actions(instrumentId, start, end)`
- `get_market_status(market)`
- `get_provider_health()`

Required behavior:

- Normalize symbols into `Instrument`.
- Include provider, timestamp, delay status, and currency.
- Return `blocking` warning for unsupported symbols.
- Return `warning` for stale or delayed data.

### `plutus_portfolio`

MVP agents receive read-only portfolio access.

Tools:

- `list_portfolios()`
- `get_portfolio_snapshot(portfolioId, asOf)`
- `get_position_history(portfolioId, instrumentId, start, end)`
- `get_watchlists()`
- `get_instrument_notes(instrumentId, portfolioId)`
- `compute_allocation(portfolioId, groupBy)`
- `compute_performance(portfolioId, start, end, benchmarkId)`

Required behavior:

- Derive only the minimum needed portfolio context for agents.
- Do not expose credentials or broker account secrets.
- Include cost-basis and holdings data only for the requested portfolio.

### `plutus_backtest`

Tools:

- `validate_strategy_spec(strategySpec)`
- `run_backtest(strategySpec, datasetRef, assumptions)`
- `get_backtest_result(backtestRunId)`
- `compare_backtests(backtestRunIds, benchmarkId)`
- `register_strategy_spec(strategySpec)`
- `get_strategy_spec(strategyId)`

Write restrictions:

- `run_backtest` only for `quant_strategy_researcher`.
- `register_strategy_spec` only for `quant_strategy_researcher`.
- `risk_manager` may read backtest results for validation.

Required behavior:

- Reject leverage, shorting, derivatives, and unsupported instruments in MVP.
- Include fee, slippage, data provider, and past-performance warning.
- Store backtest result and artifact refs before returning success.

### `plutus_risk`

Tools:

- `compute_correlation(instrumentIds, start, end, interval)`
- `compute_volatility(instrumentIdOrPortfolioId, start, end)`
- `compute_drawdown(seriesRef)`
- `check_concentration(portfolioId, limits)`
- `check_liquidity(instrumentIds, orderSizeAssumptions)`
- `run_scenario(portfolioId, scenario)`
- `register_risk_veto(runId, reason, severity, evidenceRefs)`

Write restrictions:

- `register_risk_veto` only for `risk_manager`.

Required behavior:

- Return clear warning when available data cannot support the requested risk claim.
- Register vetoes as durable audit events.

### `plutus_research`

Tools:

- `web_search(query, recency, domains)`
- `read_url(url)`
- `read_document(documentId)`
- `search_filings(instrumentId, filingTypes, start, end)`
- `get_news(instrumentId, start, end, providerPreference)`
- `summarize_sources(sourceRefs, purpose)`

Required behavior:

- Treat all external text as untrusted content.
- Detect instructions that ask the agent to ignore rules, hide risk, reveal secrets, or change tool permissions.
- Summaries must preserve source refs and prompt-injection warnings.

### `plutus_reports`

Tools:

- `create_run_card(runId, payload)`
- `render_report(runId, format, sections)`
- `create_chart_artifact(runId, chartSpec)`
- `create_mobile_summary(runId, payload)`
- `register_artifact(runId, artifact)`

Write restrictions:

- Only `report_writer` can create user-facing artifacts.

Required behavior:

- Validate final run card schema.
- Include risk caveats and assumptions.
- Store artifacts with content hash and MIME type.

### `plutus_memory`

Tools:

- `recall_user_preferences(scope)`
- `recall_prior_runs(query, filters)`
- `recall_saved_theses(instrumentIds)`
- `save_research_memory(memory)`
- `forget_research_memory(memoryId)`

Write restrictions:

- MVP should not auto-save durable user memory without explicit user approval.

### `plutus_audit`

Tools:

- `log_agent_event(runId, agentName, eventType, payloadRef)`
- `log_tool_provenance(runId, toolName, inputHash, outputHash, sourceRefs)`
- `register_warning(runId, warningType, severity, message, evidenceRefs)`
- `get_run_audit_trail(runId)`

Required behavior:

- Audit events are append-only.
- Tool provenance stores hashes and refs, not raw secrets.

## 6. Agent Allowlist

| Agent | Required Namespaces | Optional Namespaces | Write Tools |
| --- | --- | --- | --- |
| `orchestrator` | `plutus_memory`, `plutus_audit` | `plutus_market_data`, `plutus_portfolio`, `plutus_research` | run-plan audit events |
| `market_data_researcher` | `plutus_market_data`, `plutus_audit` | `plutus_research` | data warnings through audit |
| `equity_analyst` | `plutus_market_data`, `plutus_research`, `plutus_audit` | `plutus_memory`, `plutus_portfolio` | analysis event logs |
| `crypto_analyst` | `plutus_market_data`, `plutus_research`, `plutus_audit` | `plutus_memory` | analysis event logs |
| `technical_analyst` | `plutus_market_data`, `plutus_risk`, `plutus_audit` | none | chart specs in structured output only |
| `quant_strategy_researcher` | `plutus_market_data`, `plutus_backtest`, `plutus_risk`, `plutus_audit` | `plutus_memory` | `run_backtest`, `register_strategy_spec` |
| `portfolio_manager` | `plutus_portfolio`, `plutus_market_data`, `plutus_risk`, `plutus_memory`, `plutus_audit` | none | allocation recommendation events |
| `risk_manager` | `plutus_risk`, `plutus_portfolio`, `plutus_market_data`, `plutus_audit` | `plutus_backtest`, `plutus_memory` | `register_risk_veto`, risk warnings |
| `report_writer` | `plutus_reports`, `plutus_audit`, `plutus_memory` | artifact/result-ID reads from market, portfolio, backtest, risk | report and artifact creation |

## 7. Acceptance Tests

- Analyst agent cannot call broad filesystem, database, or report write tools.
- Portfolio tools reject access outside the active local profile.
- `equity_analyst` cannot call `run_backtest`.
- `quant_strategy_researcher` can call `run_backtest` for long-only MVP specs.
- `risk_manager` can register a veto and the final run card reflects it.
- `report_writer` can create a run card and mobile summary.
- Every response includes `sourceRefs`, `warnings`, and `auditRef`.

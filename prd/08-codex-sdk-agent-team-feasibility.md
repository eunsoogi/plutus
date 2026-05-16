# Plutus PRD: Codex SDK Agent Team Feasibility

## 1. Feasibility Summary

Building an agent team with the TypeScript Codex SDK is feasible, but the implementation model is different from a traditional application agent framework.

Codex SDK does not expose a typed in-process graph of `Agent` objects.

Instead, the TypeScript SDK controls local Codex agents by starting and resuming Codex threads, sending prompts, receiving buffered or streamed JSONL events, and relying on Codex's own subagent/custom-agent capabilities when parallel specialist work is needed.

For Plutus, this means the agent team should be implemented as a Codex-controlled research workflow:

- The Plutus macOS host app owns product state, market data, portfolios, tools, and persistence.
- `@openai/codex-sdk` owns Codex thread lifecycle and streamed agent execution.
- Project-scoped custom agents under `.codex/agents/` define finance specialist roles.
- Local tool namespaces expose Plutus domain tools to Codex through a Mac-hosted stdio MCP adapter with role-specific allowlists.
- Structured output schemas turn Codex results into validated product records.

## 2. Evidence From Codex SDK And Codex Docs

Official Codex SDK docs state that the TypeScript library can programmatically control local Codex agents, requires Node.js 18 or later, and supports starting a thread, calling `run()` repeatedly, and resuming a previous thread by ID.

For Plutus MVP, this runtime runs inside the macOS host app environment rather than a hosted backend.

The open-source TypeScript SDK README states that:

- `@openai/codex-sdk` wraps the `codex` CLI from `@openai/codex`.
- The SDK spawns the CLI and exchanges JSONL events over stdin/stdout.
- `run()` buffers events until the turn finishes.
- `runStreamed()` returns structured events for intermediate progress, tool calls, streaming responses, and file-change notifications.
- `outputSchema` can request JSON output conforming to a schema.
- Zod schemas can be converted to JSON Schema with `zod-to-json-schema`.
- Threads persist in `~/.codex/sessions` and can be resumed.
- Threads can be started with a controlled working directory.
- The SDK can pass environment variables and `--config` overrides to the Codex CLI.

Official Codex subagent docs state that Codex can run subagent workflows by spawning specialized agents in parallel and collecting their results into one response.

Codex supports custom agents as TOML files under `.codex/agents/` for project-scoped agents or `~/.codex/agents/` for personal agents.

Custom agents require `name`, `description`, and `developer_instructions`, and can override model, reasoning effort, sandbox mode, MCP-compatible tool configuration, and skills config.

## 3. Implementation Pattern Options

### Option A: Native Codex Subagent Team

The Plutus macOS host starts one Codex thread per research run and prompts Codex to spawn named custom agents.

Flow:

1. `CodexRunHost` creates a per-run Git working directory.
2. It writes or references project custom agents in `.codex/agents/`.
3. It starts a Codex thread with `workingDirectory`.
4. It sends a run prompt: "Use the investment_committee team. Run equity_analyst in bull-pass mode, equity_analyst in bear-pass mode, technical_analyst, portfolio_manager, risk_manager, and report_writer. Wait for all results. Return the final run card using this schema."
5. It streams progress to the macOS UI and paired mobile remote-control clients through `runStreamed()`.
6. It validates final output with Zod-derived JSON Schema.
7. It persists the Codex thread ID, run card, artifacts, and event log.

Strengths:

- Uses Codex's built-in subagent orchestration.
- Fits the user's desire for an "agent team" without adding a second agent framework.
- Lets Codex manage parallel specialist work and result consolidation.
- Custom agents can have role-specific instructions, model choices, sandbox modes, and MCP tool access.

Risks:

- Programmatic subagent control is prompt-mediated rather than a typed SDK method such as `spawnAgent()`.
- More care is needed to make outputs deterministic enough for product records.
- Token and latency costs can rise quickly because each subagent does its own work.
- Product-level audit logging must capture streamed items and final artifacts.

### Option B: Plutus-Orchestrated Multi-Thread Team

The Plutus macOS host creates separate Codex threads for each specialist and aggregates results in application code.

Flow:

1. `CodexRunHost` creates one root run record.
2. It starts separate Codex threads for each specialist role.
3. Each specialist receives a role-scoped prompt and JSON output schema.
4. The Mac host runtime waits for all specialist turns.
5. The Mac host runtime starts a final Codex synthesis thread or deterministic reducer to produce the final run card.

Strengths:

- More deterministic scheduling and persistence.
- Easier to set hard timeouts, retries, and per-agent budgets.
- Easier to map one specialist output to one database row.

Risks:

- Reimplements orchestration that Codex subagents already provide.
- More application code.
- Less natural use of Codex's built-in subagent UI/activity model.

### Recommended Hybrid

Use Option A for MVP, with Option B reserved as strict deterministic mode when product determinism matters.

MVP should use native Codex subagents for specialist teamwork, but keep every research run behind a `CodexRunHost` adapter.

The adapter must expose product-level methods such as `startResearchRun`, `streamRunEvents`, `resumeResearchRun`, and `cancelResearchRun`, rather than leaking raw SDK calls across the app.

If a workflow needs strict per-agent retry, budget, or persistence semantics, implement it with Plutus-orchestrated multi-thread execution.

## 4. Required Custom Agents

Project-scoped custom agents should live under `.codex/agents/`:

- `market-data-researcher.toml`: verifies instruments, data availability, freshness, and provider caveats.
- `equity-analyst.toml`: analyzes stocks, ETFs, fundamentals, earnings context, valuation, and sector risks.
- `crypto-analyst.toml`: analyzes crypto spot markets, liquidity, funding/basis inputs when available, and exchange-specific caveats.
- `quant-strategy-researcher.toml`: converts ideas into strategy specs and backtest plans.
- `technical-analyst.toml`: analyzes trend, momentum, volatility, indicators, and chart regimes.
- `portfolio-manager.toml`: reviews allocation, concentration, drift, benchmark exposure, and rebalancing candidates.
- `risk-manager.toml`: performs drawdown, leverage, volatility, liquidity, concentration, and scenario checks.
- `report-writer.toml`: consolidates final run cards, reports, caveats, and mobile summaries.

Each custom agent must include only the local stdio MCP adapter namespaces listed for its role in [Agent MCP Map](./09-agent-mcp-map.md).

Each custom agent must define:

- `name`.
- `description`.
- `developer_instructions`.
- Optional `model`.
- Optional `model_reasoning_effort`.
- Optional `sandbox_mode`.
- Optional role-specific local stdio MCP adapter configuration.

## 5. CodexRunHost Requirements

`CodexRunHost` must provide:

- `startResearchRun(input): Promise<ResearchRunHandle>`.
- `streamResearchRun(handle): AsyncIterable<CodexRunEvent>`.
- `resumeResearchRun(threadId): Promise<ResearchRunHandle>`.
- `requestStructuredTurn(handle, prompt, schema): Promise<T>`.
- `cancelResearchRun(handle): Promise<void>`.
- `archiveResearchRun(handle): Promise<void>`.

It must persist:

- Codex thread ID.
- Working directory.
- User request.
- Selected team preset.
- Custom agent versions.
- MCP/tool configuration hash.
- Streamed events.
- Final structured output.
- Generated artifacts.
- Warnings and validation failures.

## 6. MVP Constraints

- Use Codex SDK only in the macOS host local runtime for MVP.
- Do not expose raw Codex prompts, secrets, or environment variables to the React UI or paired mobile clients.
- Do not rely on Codex subagents for live trading decisions.
- Keep `agents.max_depth = 1` unless a separate design justifies recursive delegation.
- Cap `agents.max_threads` for predictable cost and latency.
- Require structured output for product records.
- Treat streamed output as observability, not as the final source of truth.
- Use MCP tools for market data and portfolio access instead of pasting large private datasets into prompts.

## 7. Acceptance Criteria

- A research run can start through `@openai/codex-sdk`.
- The run can ask Codex to use a named preset team and custom specialist agents.
- The run streams progress to the app.
- The run streams progress to paired mobile remote-control clients when connected.
- The final output conforms to a Zod-derived JSON Schema.
- The Codex thread ID is persisted and can be resumed.
- At least one team workflow uses multiple specialist agents and returns a consolidated report.
- The app can use Plutus-orchestrated multi-thread execution when native subagent orchestration is not deterministic enough for a workflow.

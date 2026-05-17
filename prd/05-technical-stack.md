# Plutus PRD: Technical Stack Recommendation

## 1. Recommendation

Build Plutus as a local-first TypeScript monorepo with a macOS Tauri host app, a mobile Tauri remote-control app, shared domain packages, OpenAI Codex SDK orchestration in the Mac host runtime, SQLite local persistence, local tool contracts, and no required hosted backend for MVP.

## 2. Monorepo

Recommended:

- Package manager: pnpm.
- Build system: Turborepo.
- Language: TypeScript strict mode.
- Runtime: Node.js 22+ for the local Codex runtime on macOS. The Codex SDK requires Node.js 18 or later.
- Schema validation: Zod v4.
- Testing: Vitest for unit tests, Playwright for shared webview UI flows, Tauri driver/WebDriver checks for desktop shells, and real-device iOS/Android smoke tests for mobile remote-control flows.

Package layout:

- `apps/tauri`: Tauri 2 React shell for macOS host and mobile remote-control app.
- `apps/web-preview`: development/admin browser preview that reuses Tauri frontend routes; this is not a product runtime.
- `packages/agents`: Codex run planners, specialist role prompts, structured output schemas, guardrails, and local tool contracts.
- `packages/domain`: portfolio, instrument, strategy, run-card, remote-control, and artifact domain models.
- `packages/data`: provider adapters and market data normalization.
- `packages/backtest`: strategy specs, local backtest engine, and report models.
- `packages/memory`: Plutus memory adapter, Mem0 integration, memory capture rules, retention policies, sensitivity filters, and recall/ranking schemas.
- `packages/wiki`: local Markdown wiki storage, wiki metadata, contradiction checks, revision diffs, activity feed, and revert workflows.
- `packages/local-tools`: first-party local tool router with namespace-scoped tools and per-agent allowlists.
- `packages/local-mcp-adapter`: local stdio MCP adapter that exposes approved local tool namespaces to Codex.
- `packages/remote-control`: pairing, encrypted session protocol, command schemas, and host/mobile message types.
- `packages/ui`: responsive webview UI primitives and design tokens.
- `packages/command-client`: typed client for Tauri commands and remote-control commands.

## 3. Codex Runtime

Use:

- `@openai/codex-sdk` for programmatic control of local Codex agents on the Mac host.
- `Codex` client instances inside the Mac host local runtime.
- `startThread()` for new research runs.
- `thread.run()` for buffered stage execution.
- `thread.runStreamed()` for progress events, tool activity, and UI/mobile remote-control streaming.
- `resumeThread(threadId)` for app restarts and long-running workflows.
- Project-scoped `.codex/agents/*.toml` files for finance specialist agents.
- Codex native subagent workflows for parallel specialist work.
- Plutus-orchestrated multi-thread execution for workflows requiring deterministic retries, budgets, or per-agent persistence.
- Structured output schemas for run plans, specialist findings, risk reviews, strategy specs, and final reports.
- Per-run local working directories for Codex file generation, strategy artifacts, reports, and audit logs.
- Codex CLI `config` overrides for sandbox, model, approval, and network posture.
- Codex CLI `env` controls so secrets are scoped, redacted, and never dumped into prompts.
- Local tool router for domain tools that Codex must call, including market data, portfolio state, backtesting, and report generation.
- Local stdio MCP adapter that exposes the local tool router to Codex without requiring a network service or hosted backend.
- Mem0 behind a Plutus-owned memory adapter for automatic long-term memory, semantic recall, and deletion-aware user controls.
- Local Markdown wiki storage for LLM Wiki Curator outputs, with SQLite metadata and audit links.
- Application-level guardrails around financial safety, prompt injection, and trade-execution boundaries.

Important note:

The Codex SDK is `@openai/codex-sdk` and wraps the local Codex CLI through programmatic threads and JSONL events.

Keep this behind a Plutus `CodexRunHost` adapter so the rest of the app depends on product-level workflows rather than raw SDK calls.

Codex SDK feasibility note:

The Codex SDK can support the Plutus agent team, but not as typed in-process agent objects.

The reliable product architecture is to treat Codex as a controllable local agent runtime on the Mac host.

That means Plutus should start and resume Codex threads, ask Codex to use configured custom agents/subagents, stream JSONL events, call Plutus local tools through a local stdio MCP adapter, and validate final outputs with schemas.

## 4. Local Persistence And Jobs

Recommended:

- Database: SQLite in the Mac host app data directory.
- Query/migrations: a lightweight SQLite migration layer in the Tauri Rust side or a TypeScript SQLite layer embedded in the local runtime.
- Jobs: SQLite-backed local queue for backtests, reports, provider refresh, and long-running agent stages.
- Artifacts: local app data directory files with content hashes and SQLite metadata.
- Memory: SQLite metadata plus Mem0-backed semantic memory records accessed only through the `packages/memory` adapter.
- Wiki: local Markdown pages plus SQLite metadata, source links, revision state, activity feed, and review timestamps.
- Realtime: Tauri event stream inside the Mac host app, forwarded to paired mobile devices over the remote-control session.

No MVP feature should require PostgreSQL, Redis, BullMQ, S3, Docker Compose, or a hosted API server.

## 5. Remote Control

Recommended:

- Mac host remote-control service embedded in the Tauri app.
- Pairing by QR code or short-lived pairing code.
- Encrypted session transport with device-specific session keys.
- Local network discovery where available, plus manual host address entry.
- Command schemas shared through `packages/remote-control`.
- Host-side device list, revoke button, and remote-control kill switch.
- Mobile app sends typed commands to the Mac host and receives event streams/state patches.

The mobile app is a controller and viewer for the Mac host. It does not own the source-of-truth database in MVP.

## 6. Data And Backtesting

Recommended:

- Market data adapters in `packages/data`.
- DuckDB is optional for local analytical queries if SQLite becomes insufficient; it is not required for MVP.
- Lightweight internal backtest engine for MVP long-only strategies.
- Later integration path for specialized engines if options/futures/advanced validation become necessary.

Charting:

- TradingView Lightweight Charts for time-series and candlestick views if mobile webview performance is acceptable.
- ECharts for portfolio heatmaps and correlation views if bundle size and touch interaction remain acceptable.
- Mobile charting must be tested over remote-control payloads and compact artifact views.

## 7. Security

Recommended:

- Secrets in platform secure storage.
- User tokens never exposed to agent prompts.
- Read-only broker/exchange integrations before write/trade permissions.
- Provider credentials scoped per integration.
- Audit log for agent runs, data access, generated artifacts, and future execution requests.
- Prompt-injection filters for uploaded files, URLs, and news/documents.
- Remote-control sessions require explicit pairing, encryption, revocation, and host-side visibility.

## 8. Deployment

MVP distribution:

- macOS signed/notarized Tauri host build.
- iOS signed Tauri remote-control build and App Store pipeline.
- Android signed Tauri remote-control build and Google Play pipeline.

Local development:

- Tauri dev environment.
- SQLite database in app data directory or temporary dev path.
- `.env.example` with provider keys and safe local defaults.

## 9. Trade-Offs

- Local-first architecture avoids backend operations and keeps user portfolio state on the Mac host, but the Mac must be reachable for mobile remote control.
- Mobile remote control is simpler than multi-device sync, but disconnected mobile edits are not available in MVP.
- A custom MVP backtest engine is faster to ship for simple long-only flows, but advanced quant validation may eventually justify an external engine.
- Mac-hosted Codex orchestration centralizes run history and safety controls locally, but requires careful per-run workspace isolation and cost controls.

## 10. Acceptance Criteria

- A new engineer can scaffold the local-first monorepo from this stack without choosing major technologies again.
- The Mac host Codex runtime can start one local development research thread, stream progress, produce a structured run card, and persist the Codex thread ID in SQLite.
- The Mac host can expose a paired encrypted remote-control session to mobile.
- Mobile can start, observe, and cancel a Mac-hosted research run.
- Backtest jobs can run locally and stream status to the Mac UI and paired mobile controller.

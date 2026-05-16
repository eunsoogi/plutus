# Plutus PRD: Technical Stack Recommendation

## 1. Recommendation

Build Plutus as a TypeScript monorepo with a shared domain layer, OpenAI Codex SDK orchestration, a server API for sync and jobs, and one Tauri 2 app shell targeting macOS, iOS, and Android.

## 2. Monorepo

Recommended:

- Package manager: pnpm.
- Build system: Turborepo.
- Language: TypeScript strict mode.
- Runtime: Node.js 22+ for server runtime consistency. The Codex SDK requires Node.js 18 or later.
- Schema validation: Zod v4.
- Testing: Vitest for unit tests, Playwright for shared webview UI flows, Tauri driver/WebDriver checks for desktop shells, and real-device iOS/Android smoke tests for Tauri mobile builds.

Package layout:

- `apps/server`: API, job workers, Codex SDK agent-host entry points.
- `apps/tauri`: Tauri 2 React shell for macOS, iOS, and Android.
- `apps/web-preview`: development/admin browser preview that reuses Tauri frontend routes; this is not a second product app shell.
- `packages/agents`: Codex run planners, specialist role prompts, structured output schemas, guardrails, and tool contracts.
- `packages/domain`: portfolio, instrument, strategy, run-card domain models.
- `packages/data`: provider adapters and market data normalization.
- `packages/backtest`: strategy specs, backtest engine adapters, report models.
- `packages/mcp-server`: first-party Plutus MCP server with namespace-scoped tools and per-agent allowlists.
- `packages/ui`: responsive webview UI primitives and design tokens.
- `packages/api-client`: typed client shared by apps.

## 3. Codex Runtime

Use:

- `@openai/codex-sdk` for programmatic control of local Codex agents.
- `Codex` client instances inside a server-side agent host.
- `startThread()` for new research runs.
- `thread.run()` for buffered stage execution.
- `thread.runStreamed()` for progress events, tool activity, and UI streaming.
- `resumeThread(threadId)` for app restarts, long-running workflows, and cross-device continuity.
- Project-scoped `.codex/agents/*.toml` files for finance specialist agents.
- Codex native subagent workflows for parallel specialist work.
- Plutus-orchestrated multi-thread execution for workflows requiring deterministic retries, budgets, or per-agent persistence.
- Structured output schemas for run plans, specialist findings, risk reviews, strategy specs, and final reports.
- Per-run Git working directories for Codex file generation, strategy artifacts, reports, and audit logs.
- Codex CLI `config` overrides for sandbox, model, approval, and network posture.
- Codex CLI `env` controls so secrets are scoped, redacted, and never dumped into prompts.
- MCP servers for domain tools that Codex must call, including market data, portfolio state, backtesting, and report generation.
- Application-level guardrails around financial safety, prompt injection, and trade-execution boundaries.

Important note:

The Codex SDK is `@openai/codex-sdk` and wraps the local Codex CLI through programmatic threads and JSONL events. Keep this behind a Plutus `CodexRunHost` adapter so the rest of the app depends on product-level workflows rather than raw SDK calls.

Codex SDK feasibility note:

The Codex SDK can support the Plutus agent team, but not as typed in-process agent objects. The reliable product architecture is to treat Codex as a controllable agent runtime: start and resume Codex threads, ask Codex to use configured custom agents/subagents, stream JSONL events, call Plutus MCP tools, and validate final outputs with schemas.

## 4. Backend

Recommended:

- API framework: Fastify or Hono.
- API contract: tRPC for TypeScript-native app integration, or OpenAPI with Zod schemas if external API clients matter.
- Database: PostgreSQL.
- Time-series extension: TimescaleDB when historical price volume grows.
- ORM/query: Drizzle ORM for explicit SQL-friendly TypeScript.
- Jobs: BullMQ with Redis.
- Object storage: S3-compatible storage for reports, charts, and artifacts.
- Realtime: Server-Sent Events for agent run streaming; WebSocket only where bidirectional transport is needed.

## 5. Data And Backtesting

Recommended:

- Market data adapters in `packages/data`.
- DuckDB for local analytical queries and backtest result exploration.
- Lightweight internal backtest engine for MVP long-only strategies.
- Later integration path for specialized engines if options/futures/advanced validation become necessary.

Charting:

- TradingView Lightweight Charts for time-series and candlestick views if mobile webview performance is acceptable.
- ECharts for portfolio heatmaps and correlation views if bundle size and touch interaction remain acceptable.
- A mobile chart alternative must be selected during the Tauri mobile proof-of-capability milestone if either charting library performs poorly in iOS/Android webviews.

## 6. Security

Recommended:

- Secrets in platform secure storage for clients and encrypted server-side secret store for backend.
- User tokens never exposed to agent prompts.
- Read-only broker/exchange integrations before write/trade permissions.
- Provider credentials scoped per integration.
- Audit log for agent runs, data access, generated artifacts, and future execution requests.
- Prompt-injection filters for uploaded files, URLs, and news/documents.

## 7. Deployment

MVP deployment:

- Server on Fly.io, Render, Railway, or AWS ECS depending on operational preference.
- PostgreSQL managed service.
- Redis managed service.
- S3-compatible object storage.
- macOS signed/notarized Tauri build.
- iOS signed Tauri build and App Store pipeline.
- Android signed Tauri build and Google Play pipeline.

Local development:

- Docker Compose for Postgres, Redis, and local object storage.
- `.env.example` with provider keys and safe defaults.

## 8. Trade-Offs

- Tauri reduces app-shell duplication and keeps one React/Rust architecture across macOS and mobile, but mobile webview behavior, plugin coverage, and store-release workflows must be proven early on real devices.
- Mobile capability gaps must be solved inside the Tauri architecture through official plugins, custom plugins, Rust commands, or platform-specific Swift/Kotlin bindings.
- Drizzle favors explicitness and TypeScript ergonomics over heavier ORM magic.
- A custom MVP backtest engine is faster to ship for simple long-only flows, but advanced quant validation may eventually justify an external engine.
- Server-side Codex orchestration centralizes run history and safety controls, but requires careful per-run workspace isolation and cost controls.

## 9. Acceptance Criteria

- A new engineer can scaffold the monorepo from this stack without choosing major technologies again.
- The Codex runtime can start one local development research thread, stream progress, produce a structured run card, and persist the Codex thread ID.
- One Tauri project can build macOS, iOS, and Android shells that share domain models, API types, and responsive UI primitives.
- Backtest jobs can run asynchronously and stream status to clients.

# Plutus Spec: System Architecture

## 1. Goal

Define the MVP system architecture for Plutus: a local-first macOS research workstation where a user can create portfolios and watchlists, ask natural-language research questions, run Codex-controlled specialist workflows, and receive risk-reviewed run cards and reports.

The same architecture lets the user control the Mac host from mobile without requiring a hosted backend.

## 2. Non-Negotiable Boundaries

- MVP is research, simulation, and decision support only.
- No live trade execution, broker order placement, or autonomous capital allocation.
- All recommendations must include evidence, assumptions, data freshness, risk caveats, and one recommendation category.
- Provider secrets, raw Codex environment variables, and unrestricted agent prompts stay inside the local app runtime.
- Agents access product data only through first-party local tools and structured inputs.
- MVP must run without PostgreSQL, Redis, BullMQ, S3, a hosted API server, or managed cloud services.
- macOS is the source-of-truth host for MVP. Mobile is a paired remote controller, not an independent sync peer.

## 3. Monorepo Layout

```text
plutus/
  apps/
    tauri/
      src/
      src-tauri/
        src/
          commands/
          runtime/
          storage/
          secure-store/
          remote_control/
    web-preview/
      src/
      tests/
  packages/
    domain/
      src/
        instrument/
        portfolio/
        watchlist/
        strategy/
        research-run/
        artifact/
    data/
      src/
        providers/
        normalization/
        freshness/
    agents/
      src/
        codex-run-host/
        workflows/
        schemas/
        guardrails/
    backtest/
      src/
        engine/
        strategies/
        metrics/
        reports/
    memory/
      src/
        adapter/
        capture/
        recall/
        repositories/
    wiki/
      src/
        curator/
        storage/
        schemas/
    local-tools/
      src/
        namespaces/
        authz/
        audit/
    local-mcp-adapter/
      src/
    command-client/
      src/
    remote-control/
      src/
    ui/
      src/
        primitives/
        charts/
        layouts/
    test-fixtures/
      src/
  tests/
    e2e/
  .codex/
    agents/
```

## 4. Package Responsibilities

| Package/App | Responsibility |
| --- | --- |
| `apps/tauri` | macOS host shell and mobile remote-control shell; responsive React webview; native capability bridge; local runtime commands |
| `apps/web-preview` | Development/admin browser preview using the same frontend route set as Tauri; Codex in-app browser verification surface |
| `packages/domain` | Zod schemas, TypeScript types, domain invariants, ID formats, enum contracts |
| `packages/data` | Provider adapters, symbol resolution, candle normalization, freshness warnings |
| `packages/agents` | `CodexRunHost`, workflow planner, structured output schemas, role prompts, agent guardrails, local event stream |
| `packages/backtest` | Strategy spec validation, long-only simulation, metrics, chart/report data models |
| `packages/memory` | Mem0-backed automatic memory capture, recall, sensitivity filtering, retention, and user controls |
| `packages/wiki` | Local Markdown wiki storage, autonomous curator workflows, revision history, diffs, and revert support |
| `packages/local-tools` | MCP-shaped local namespace tools with per-agent allowlists and audit hooks |
| `packages/local-mcp-adapter` | Local stdio MCP adapter exposing approved local tool namespaces to Codex |
| `packages/command-client` | Typed local command client shared by Tauri and web preview |
| `packages/remote-control` | Pairing protocol, encrypted session messages, remote command schemas, host/mobile event contracts |
| `packages/ui` | Webview-safe UI primitives, chart wrappers, design tokens |
| `packages/test-fixtures` | Deterministic MVP seed fixtures shared by unit, integration, E2E, Tauri smoke, and agent harness tests |

## 5. Runtime Components

### Local App Runtime

The Tauri Rust side owns local capabilities and exposes typed commands to the React webview.

- Persistence: SQLite through Tauri SQL or a bundled SQLite layer.
- Jobs: an app-local async queue backed by SQLite rows, not Redis.
- Artifact storage: app data directory files with content hashes and SQLite metadata.
- Realtime: local event emitter from runtime to webview, not SSE.
- Secure storage: Keychain on macOS/iOS and Android Keystore where available.
- Network: direct provider HTTP calls from the local runtime or from webview only when safe.
- Remote control: Mac-hosted encrypted command/event service for paired mobile devices.

### Agent Host

`packages/agents` owns Codex SDK integration.

`apps/tauri/src-tauri/src/runtime` starts the local Node/Codex runtime on desktop builds and calls it through a narrow command bridge. It must expose product-level operations only:

```ts
export interface CodexRunHost {
  startResearchRun(input: StartResearchRunInput): Promise<ResearchRunHandle>;
  streamResearchRun(handle: ResearchRunHandle): AsyncIterable<CodexRunEvent>;
  resumeResearchRun(threadId: string): Promise<ResearchRunHandle>;
  requestStructuredTurn<T>(
    handle: ResearchRunHandle,
    request: StructuredTurnRequest<T>,
  ): Promise<T>;
  cancelResearchRun(handle: ResearchRunHandle): Promise<void>;
  archiveResearchRun(handle: ResearchRunHandle): Promise<void>;
}
```

The rest of Plutus must not call `@openai/codex-sdk` directly.

### Local Tool Router And Codex Adapter

MVP implements one local tool router with MCP-shaped namespace contracts:

```bash
pnpm --filter @plutus/local-tools test plutus_market_data
pnpm --filter @plutus/local-tools test plutus_portfolio
pnpm --filter @plutus/local-tools test plutus_backtest
pnpm --filter @plutus/local-tools test plutus_memory
pnpm --filter @plutus/local-tools test plutus_wiki
```

The router must enforce:

- agent role allowlist;
- tool-level read/write permission;
- schema validation;
- audit logging;
- source metadata and warnings in every tool response.

Codex does not call the in-process router directly.

The Mac host starts a local stdio MCP adapter that exposes approved namespaces to Codex and delegates each call back to the local router with the active run context. This keeps Codex integration explicit without introducing a hosted service.

## 6. Primary MVP Flow

1. User creates a portfolio and watchlist in the Tauri app.
2. Tauri command creates a `research_runs` row in local SQLite and a per-run workspace in the app data directory.
3. `CodexRunHost` starts a Codex thread in the per-run workspace on desktop builds.
4. Orchestrator classifies intent and selects a team preset.
5. Specialist agents use allowed local tools through the stdio MCP adapter for market data, portfolio, risk, backtest, research, memory, wiki, audit, and reports.
6. The local runtime emits run events to the macOS webview and paired mobile controllers.
7. Risk manager validates the recommendation and can register warnings or vetoes.
8. Report writer creates a run card, report artifact, chart artifacts, and mobile summary.
9. The app validates structured final output, persists artifacts, and marks run complete.
10. Memory capture service stores eligible atomic memories through `plutus_memory`.
11. LLM Wiki Curator maintains local wiki pages through `plutus_wiki`.
12. Mobile views and controls the same Mac-hosted state through the paired remote-control session.

## 7. Deployment Shape

MVP local development:

- Node.js 22+
- pnpm
- SQLite database in the app data directory
- Tauri dev tools
- Codex CLI configured locally for development agent runs
- root scripts from [Codex Development Automation](./08-codex-development-automation.md) for typecheck, lint, unit, integration, E2E, MCP, agent, Tauri, and acceptance verification
- `apps/web-preview` dev server for Codex in-app browser inspection of desktop and mobile routes

MVP production:

- Signed/notarized macOS build
- Signed iOS and Android remote-control proof-of-capability builds before beta
- Optional user-controlled backup/export location such as local file export in a later phase

## 8. Architecture Decisions

| Decision | Rationale |
| --- | --- |
| Tauri-only app shell | Avoid separate macOS/mobile product stacks while preserving native capability paths through Rust/Swift/Kotlin bindings |
| Local-first app runtime | Avoids requiring users to run or trust a backend for MVP |
| Codex runtime behind adapter | Keeps Codex thread control, workspaces, model config, and audit logging isolated from UI code |
| Local tool router plus stdio MCP adapter | Limits private data exposure while giving Codex a standard tool interface without a hosted service |
| Mem0 behind Plutus memory adapter | Gives agents runtime recall while keeping sensitivity, retention, audit, and deletion semantics product-owned |
| Agent-maintained local wiki | Gives Plutus a durable knowledge base without putting full wiki pages into runtime memory |
| SQLite first | Fits Mac app packaging and handles relational portfolio/run state locally |
| SQLite-backed local queue | Supports resumable backtests and agent jobs without Redis |
| Local event stream | Gives progress updates inside the app without SSE infrastructure |
| Mobile remote control | Avoids multi-device sync while still letting the user inspect and command Mac-hosted runs from mobile |
| Codex-verifiable development surface | Keeps implementation work reproducible by exposing deterministic fixtures, stable root scripts, mocked agent harnesses, and a browser-preview surface that Codex can inspect |

## 9. Open Implementation Choices

- Charting library: validate TradingView Lightweight Charts and ECharts on real Tauri mobile webviews before UI freeze.
- Equity data provider: start with Yahoo-compatible adapter but keep provider interface explicit for Polygon/Tiingo migration.
- Crypto OHLCV provider: start with CoinGecko metadata and CCXT exchange candles where credentials/limits permit.
- Remote-control transport: choose the simplest encrypted local-network transport that works across Tauri desktop/mobile, with manual host address entry when discovery fails.

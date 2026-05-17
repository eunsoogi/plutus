# Plutus MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Plutus MVP core loop as a local-first Mac-hosted app: portfolio/watchlist setup, app-local agent-assisted research runs on macOS, risk-reviewed run cards, basic backtests, and mobile remote control without requiring a hosted backend.

**Architecture:** TypeScript pnpm/Turborepo monorepo centered on one Tauri 2 React app family.

Product state lives in Mac-hosted SQLite and artifact files. Codex is isolated behind `CodexRunHost`; agents access product data through role-scoped local tools exposed by a stdio MCP adapter. Mobile pairs with the Mac host and sends encrypted remote-control commands.

**Tech Stack:** Node.js 22+, pnpm, Turborepo, TypeScript strict mode, Zod v4, SQLite, Tauri 2, Rust command bridge, React, Vite, Vitest, Playwright, `@openai/codex-sdk`.

**Codex Development Contract:** Each phase must expose deterministic scripts, fixtures, tests, and browser-preview surfaces described in [Codex Development Automation](./08-codex-development-automation.md). Codex should be able to implement a phase, run its local gate, inspect UI changes through the in-app browser when relevant, and report exact blockers when a higher-level gate cannot run locally.

---

## Phase 0: Repository Scaffold

**Files:**

- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `tsconfig.base.json`
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`
- Create: `.env.example`
- Create: `apps/tauri/package.json`
- Create: `apps/web-preview/package.json`
- Create: `packages/domain/package.json`
- Create: `packages/data/package.json`
- Create: `packages/agents/package.json`
- Create: `packages/backtest/package.json`
- Create: `packages/memory/package.json`
- Create: `packages/wiki/package.json`
- Create: `packages/local-tools/package.json`
- Create: `packages/local-mcp-adapter/package.json`
- Create: `packages/remote-control/package.json`
- Create: `packages/command-client/package.json`
- Create: `packages/ui/package.json`
- Create: `packages/test-fixtures/package.json`
- Create: `packages/test-fixtures/src/*.ts`
- Create: `tests/e2e/package.json`

- [ ] Create pnpm workspace and Turborepo config.
- [ ] Add strict TypeScript base config with path aliases.
- [ ] Add package-level build, typecheck, lint, unit, integration, and E2E scripts.
- [ ] Add root scripts from [Codex Development Automation](./08-codex-development-automation.md).
- [ ] Configure Vitest projects for package unit and integration tests.
- [ ] Configure Playwright projects for desktop web preview and mobile remote-control viewports.
- [ ] Add `.env.example` for market-data providers, Codex runtime config, and local app data overrides only.
- [ ] Add deterministic MVP fixtures package scaffold.
- [ ] Add root test scripts for persistence, commands, MCP, agent, remote-control, Tauri, and acceptance gates.
- [ ] Run `pnpm install`.
- [ ] Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm format:check` and verify all empty packages compile and test runners execute.

## Phase 1: Domain Schemas

**Files:**

- Create: `packages/domain/src/common.ts`
- Create: `packages/domain/src/instrument/schema.ts`
- Create: `packages/domain/src/portfolio/schema.ts`
- Create: `packages/domain/src/watchlist/schema.ts`
- Create: `packages/domain/src/strategy/schema.ts`
- Create: `packages/domain/src/research-run/schema.ts`
- Create: `packages/domain/src/artifact/schema.ts`
- Create: `packages/domain/src/memory/schema.ts`
- Create: `packages/domain/src/wiki/schema.ts`
- Create: `packages/domain/src/remote-control/schema.ts`
- Create: `packages/domain/src/index.ts`

- [ ] Implement enum schemas from [Domain Model And Persistence](./01-domain-model-and-persistence.md).
- [ ] Implement portfolio, position, watchlist, instrument, strategy, research run, artifact, memory, wiki, remote-control, and freshness schemas.
- [ ] Add Vitest tests for enum parsing, invalid recommendation categories, remote command validation, and data freshness warnings.
- [ ] Export types with `z.infer`.
- [ ] Run `pnpm --filter @plutus/domain test`.

## Phase 2: Local Persistence

**Files:**

- Create: `apps/tauri/src-tauri/src/storage/schema/*.rs`
- Create: `apps/tauri/src-tauri/src/storage/repositories/*.rs`
- Create: `apps/tauri/src-tauri/src/storage/migrations/*.sql`
- Create: `apps/tauri/src-tauri/src/storage/app_data.rs`
- Create: `apps/tauri/src-tauri/src/storage/remote_devices.rs`
- Create: `apps/tauri/src-tauri/src/seed/mvp_scenario.rs`

- [ ] Define SQLite tables matching [Domain Model And Persistence](./01-domain-model-and-persistence.md).
- [ ] Add local repository functions for instruments, portfolios, watchlists, research runs, artifacts, strategies, memory records, wiki pages, paired remote devices, and audit events.
- [ ] Add app data directory layout for SQLite database, run workspaces, artifacts, and backups.
- [ ] Add seed data for AAPL, NVDA, BTC, ETH, USDC, USD cash, SPY, QQQ.
- [ ] Reuse seed data through `packages/test-fixtures` so Codex tests and Playwright scenarios share the same MVP state.
- [ ] Add repository tests against a temporary SQLite database.
- [ ] Run migrations and seed locally through a Tauri dev command.
- [ ] Run `pnpm test:persistence`.

## Phase 3: Local Commands

**Files:**

- Create: `apps/tauri/src-tauri/src/commands/portfolio.rs`
- Create: `apps/tauri/src-tauri/src/commands/watchlist.rs`
- Create: `apps/tauri/src-tauri/src/commands/research_run.rs`
- Create: `apps/tauri/src-tauri/src/commands/artifact.rs`
- Create: `packages/command-client/src/index.ts`

- [ ] Implement typed local commands from [Apps, Local Commands, And Remote Control](./05-apps-local-commands-and-remote-control.md).
- [ ] Add TypeScript command client wrappers.
- [ ] Add tests or smoke commands for portfolio create/list, position thesis edit, watchlist edit, run lookup, artifact lookup, and remote-control-safe payloads.
- [ ] Verify command responses do not expose raw secrets or unrestricted prompt context.
- [ ] Run `pnpm test:commands`.

## Phase 4: Market Data And Portfolio Services

**Files:**

- Create: `packages/data/src/providers/provider.ts`
- Create: `packages/data/src/providers/yahoo-compatible.ts`
- Create: `packages/data/src/providers/coingecko.ts`
- Create: `packages/data/src/providers/ccxt.ts`
- Create: `packages/data/src/normalization/candles.ts`
- Create: `packages/local-tools/src/services/portfolio-service.ts`
- Create: `packages/local-tools/src/services/market-data-service.ts`

- [ ] Implement provider interface with source metadata and freshness warnings.
- [ ] Implement free-provider failover policy with provider health, quota, stale-data, and missing-field warnings.
- [ ] Implement symbol resolution and normalized quote/OHLCV responses.
- [ ] Implement allocation and performance service methods over local SQLite repositories.
- [ ] Add stale-data warning tests.
- [ ] Add BTC/NVDA correlation input fixture for the MVP scenario.

## Phase 5: Local Tool Router

**Files:**

- Create: `packages/local-tools/src/router.ts`
- Create: `packages/local-tools/src/context.ts`
- Create: `packages/local-tools/src/authz/agent-allowlists.ts`
- Create: `packages/local-tools/src/namespaces/*.ts`
- Create: `packages/local-tools/src/schemas/envelope.ts`

- [ ] Implement local tool response envelope from [Local Tool Surface](./03-local-tool-surface.md).
- [ ] Implement authorization by run ID, profile ID, agent name, namespace, tool, and write scope.
- [ ] Implement `plutus_market_data`, `plutus_portfolio`, `plutus_risk`, `plutus_backtest`, `plutus_reports`, and `plutus_audit` MVP tools.
- [ ] Register `plutus_memory` and `plutus_wiki` namespace placeholders; full implementations land in Phase 8.
- [ ] Add tests proving blocked cross-profile portfolio access and blocked unauthorized write tools.
- [ ] Verify `quant_strategy_researcher` can call `run_backtest` and `equity_analyst` cannot.

## Phase 6: Local MCP Adapter

**Files:**

- Create: `packages/local-mcp-adapter/src/index.ts`
- Create: `packages/local-mcp-adapter/src/stdio-server.ts`
- Create: `packages/local-mcp-adapter/src/namespace-registry.ts`
- Create: `packages/local-mcp-adapter/src/run-context.ts`

- [ ] Implement stdio MCP adapter that exposes approved local tool namespaces to Codex.
- [ ] Delegate adapter calls to `packages/local-tools`.
- [ ] Reject requests without a valid run context.
- [ ] Add tests proving role allowlists are enforced through the adapter.
- [ ] Verify no network listener or hosted service is required.

## Phase 7: Backtesting

**Files:**

- Create: `packages/backtest/src/strategy-spec.ts`
- Create: `packages/backtest/src/engine/long-only-engine.ts`
- Create: `packages/backtest/src/engine/portfolio-rebalance-engine.ts`
- Create: `packages/backtest/src/queue/local-backtest-queue.ts`
- Create: `packages/backtest/src/metrics/*.ts`
- Create: `packages/backtest/src/reports/*.ts`

- [ ] Implement `StrategySpecSchema`.
- [ ] Implement validation for MVP-supported long-only strategies.
- [ ] Implement SQLite-backed local queue for longer backtest jobs.
- [ ] Implement BTC 20/50 moving-average crossover fixture.
- [ ] Implement metrics and report model.
- [ ] Add tests for valid BTC crossover, unsupported leverage rejection, queue persistence, and report caveat inclusion.

## Phase 8: Memory And LLM Wiki

**Files:**

- Create: `packages/memory/src/adapter/mem0-adapter.ts`
- Create: `packages/memory/src/capture/*.ts`
- Create: `packages/memory/src/recall/*.ts`
- Create: `packages/memory/src/repositories/memory-repository.ts`
- Create: `packages/wiki/src/curator/*.ts`
- Create: `packages/wiki/src/storage/*.ts`
- Create: `packages/wiki/src/schemas/*.ts`
- Create: `packages/local-tools/src/namespaces/memory.ts`
- Create: `packages/local-tools/src/namespaces/wiki.ts`

- [ ] Implement fake Mem0 adapter for deterministic tests.
- [ ] Implement configured Mem0 adapter behind `packages/memory`.
- [ ] Implement sensitivity filtering, automatic capture policy, recall ranking, memory activity, edit/archive/delete, and category toggles.
- [ ] Implement local Markdown wiki storage, metadata, revision history, activity feed, and revert.
- [ ] Implement `plutus_memory` and `plutus_wiki` local tool namespaces against the memory/wiki packages.
- [ ] Implement wiki maintenance planner interfaces and contradiction checks.
- [ ] Add tests proving automatic memory capture, recall, wiki page create/update, wiki source memory, wiki pointer memory, and no full wiki page body stored in Mem0.
- [ ] Run memory/wiki unit and integration tests.

## Phase 9: Codex Agent Runtime

**Files:**

- Create: `packages/agents/src/codex-run-host/*.ts`
- Create: `packages/agents/src/schemas/*.ts`
- Create: `packages/agents/src/workflows/*.ts`
- Create: `apps/tauri/src-tauri/src/runtime/codex_runtime.rs`
- Create: `apps/tauri/src-tauri/src/runtime/events.rs`
- Create: `.codex/agents/market-data-researcher.toml`
- Create: `.codex/agents/equity-analyst.toml`
- Create: `.codex/agents/crypto-analyst.toml`
- Create: `.codex/agents/quant-strategy-researcher.toml`
- Create: `.codex/agents/technical-analyst.toml`
- Create: `.codex/agents/portfolio-manager.toml`
- Create: `.codex/agents/risk-manager.toml`
- Create: `.codex/agents/report-writer.toml`
- Create: `.codex/agents/llm-wiki-curator.toml`

- [ ] Implement `CodexRunHost` interface and SDK adapter.
- [ ] Implement per-run workspace creation under the app data directory.
- [ ] Implement structured turn validation with Zod-derived JSON Schema.
- [ ] Implement stage state machine and local event mapping.
- [ ] Add project custom-agent TOML files with explicit local stdio MCP adapter allowlists.
- [ ] Wire `llm_wiki_curator` into the wiki maintenance planner.
- [ ] Trigger automatic memory capture and LLM Wiki Curator maintenance after completed runs.
- [ ] Add integration test with a mocked Codex SDK for the BTC/NVDA portfolio review request.
- [ ] Add a scripted Codex SDK test harness for deterministic streamed events and structured-turn failures.
- [ ] Document that full Codex runs execute on the Mac host and mobile controls them remotely.
- [ ] Run `pnpm test:agent`.

## Phase 10: Remote Control

**Files:**

- Create: `packages/remote-control/src/pairing.ts`
- Create: `packages/remote-control/src/messages.ts`
- Create: `packages/remote-control/src/session.ts`
- Create: `apps/tauri/src-tauri/src/remote_control/pairing.rs`
- Create: `apps/tauri/src-tauri/src/remote_control/session.rs`
- Create: `apps/tauri/src-tauri/src/remote_control/commands.rs`
- Create: `apps/tauri/src/features/remote-control/*`

- [ ] Implement QR/short-code pairing message schemas.
- [ ] Implement encrypted session key creation and storage.
- [ ] Implement Mac host device list, revoke, and kill switch.
- [ ] Implement remote command authorization against paired-device permissions.
- [ ] Implement connected in-app run completion notifications from Mac host to paired mobile clients.
- [ ] Implement local network discovery where available and manual host address entry when discovery is unavailable.
- [ ] Forward allowed run progress events from Mac host to mobile.
- [ ] Add tests for revoked-device command rejection and stale-session handling.
- [ ] Run `pnpm test:remote`.

## Phase 11: Tauri App UI

**Files:**

- Create: `apps/tauri/src/routes/*.tsx`
- Create: `apps/tauri/src/features/portfolio/*`
- Create: `apps/tauri/src/features/watchlist/*`
- Create: `apps/tauri/src/features/runs/*`
- Create: `apps/tauri/src/features/artifacts/*`
- Create: `apps/tauri/src/features/memory/*`
- Create: `apps/tauri/src/features/wiki/*`
- Create: `apps/tauri/src/features/remote/*`
- Create: `packages/ui/src/*`

- [ ] Build Mac host dashboard, portfolio, watchlist, run history, run detail, and artifact routes.
- [ ] Build macOS agent run composer.
- [ ] Build memory activity, category controls, edit/archive/delete surfaces.
- [ ] Build wiki browser, activity feed, diff view, revision timeline, and revert action.
- [ ] Render run progress from local Tauri events.
- [ ] Build mobile pairing, connection, remote dashboard, remote run detail, and remote artifact routes.
- [ ] Render risk warnings visibly on desktop and mobile remote-control widths.
- [ ] Add remote watchlist note and position thesis edits while connected.
- [ ] Add Playwright tests for core webview flows.
- [ ] Run `pnpm dev:web` and inspect the app with the Codex in-app browser at desktop and mobile widths.
- [ ] Verify charts render nonblank content, text does not overlap, and connected/disconnected/revoked states are visible.
- [ ] Run `pnpm test:e2e:ui`.

## Phase 12: Security And Proof-Of-Capability

**Files:**

- Create: `apps/tauri/src-tauri/src/security/*.rs`
- Create: `apps/tauri/src-tauri/src/audit/*.rs`
- Create: `apps/tauri/src/native-capability-checks/*`

- [ ] Implement prompt-injection warning detection for `plutus_research`.
- [ ] Implement secret redaction in logs and streamed events.
- [ ] Implement platform secure storage for provider secrets.
- [ ] Implement secure storage for remote-control pairing keys.
- [ ] Implement per-run workspace path guard.
- [ ] Verify no MVP tool can place trades.
- [ ] Verify memory capture blocks credentials, private keys, API tokens, seed phrases, and unrestricted account history.
- [ ] Verify wiki maintenance writes are source-linked, audited, versioned, and reversible.
- [ ] Run Tauri mobile proof-of-capability checks for biometric lock, remote pairing, app lifecycle, remote event delivery, artifact viewing, and secure storage.

## Phase 13: MVP Acceptance Scenario

**Scenario:**

```text
BTC and NVDA exposure together looks risky. Review my portfolio and suggest what to inspect.
```

- [ ] Seed local SQLite portfolio with AAPL, NVDA, BTC, ETH, USDC, USD cash.
- [ ] Start research run from macOS UI.
- [ ] Pair a mobile device with the Mac host.
- [ ] Start a second research run from mobile and verify the Mac host executes it.
- [ ] Verify selected team is `portfolio_review_committee`.
- [ ] Verify market data, portfolio snapshot, allocation, and correlation/freshness checks run.
- [ ] Verify risk manager warning or veto is reflected in final run card.
- [ ] Verify final category is allowed.
- [ ] Verify run card, report, chart data, and mobile summary artifacts persist locally.
- [ ] Verify eligible safe memory is captured automatically and appears in the memory activity feed.
- [ ] Verify LLM Wiki Curator creates or updates a source-linked wiki page and that the revision can be reverted.
- [ ] Verify mobile receives run progress and can open the Mac-hosted report artifact.
- [ ] Revoke the mobile device and verify further remote commands fail.
- [ ] Run `pnpm test:acceptance`.
- [ ] Run Codex in-app browser inspection for the complete seeded scenario.

## Definition Of Done

- All PRD acceptance criteria marked MVP are covered by implemented tests or documented manual proof checks adjusted for local-first MVP.
- Every phase-specific completion gate in [Codex Development Automation](./08-codex-development-automation.md) passes or has an exact documented environment blocker.
- All final run cards include source refs, assumptions, data freshness, risk checklist, dissenting views, artifacts, and approval requirement.
- No MVP path can execute live trades.
- No MVP path requires PostgreSQL, Redis, BullMQ, S3, or a hosted API server.
- Mobile MVP controls the Mac host through pairing and remote commands instead of owning a separate synced database.
- `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm test:acceptance`, and `pnpm test:tauri` pass.
- UI changes have been inspected through `apps/web-preview` in the Codex in-app browser before completion.

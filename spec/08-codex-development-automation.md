# Plutus Spec: Codex Development Automation

## 1. Goal

Define the development contract that lets Codex implement, test, inspect, and verify Plutus changes from the repository root without relying on hidden manual steps.

This spec applies to all MVP phases in [MVP Implementation Plan](./07-mvp-implementation-plan.md).

## 2. Codex Worker Contract

Codex development must be possible from a clean checkout with:

- Node.js 22+;
- pnpm;
- Rust and Tauri prerequisites;
- local Codex configuration for agent runtime integration tests;
- optional provider keys from `.env.local`, never committed;
- no PostgreSQL, Redis, BullMQ, S3, hosted API server, or hosted MCP service.

Every implementation task must leave behind:

- source changes;
- unit, integration, E2E, or proof tests matching the risk of the change;
- updated seed data or fixtures when product flows depend on deterministic state;
- a verification command that can be rerun by Codex from the repo root.

Codex should prefer deterministic local tests over manual inspection. Manual browser or Tauri inspection is required only for UI layout, responsive behavior, native capability checks, and app shell integration that automated tests cannot fully prove.

## 3. Required Root Scripts

The root `package.json` must expose these scripts:

```json
{
  "scripts": {
    "dev": "turbo dev",
    "dev:web": "pnpm --filter @plutus/web-preview dev",
    "dev:tauri": "pnpm --filter @plutus/tauri tauri dev",
    "build": "turbo build",
    "typecheck": "turbo typecheck",
    "lint": "turbo lint",
    "test": "turbo test",
    "test:unit": "turbo test:unit",
    "test:integration": "turbo test:integration",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --project=web-preview",
    "test:mcp": "pnpm --filter @plutus/local-mcp-adapter test",
    "test:agent": "pnpm --filter @plutus/agents test:integration",
    "test:persistence": "pnpm --filter @plutus/tauri test:persistence",
    "test:commands": "pnpm --filter @plutus/tauri test:commands && pnpm --filter @plutus/command-client test",
    "test:remote": "pnpm --filter @plutus/remote-control test && pnpm --filter @plutus/tauri test:remote-control",
    "test:tauri": "pnpm --filter @plutus/tauri test:tauri",
    "test:acceptance": "pnpm test:unit && pnpm test:integration && pnpm test:persistence && pnpm test:commands && pnpm test:mcp && pnpm test:agent && pnpm test:remote && pnpm test:e2e",
    "format": "prettier --write .",
    "format:check": "prettier --check ."
  }
}
```

Package-level scripts may call Vitest, Rust tests, Playwright, or Tauri commands, but the root scripts are the stable interface for Codex and CI.

## 4. Automated Test Layers

### Unit Tests

Use Vitest for TypeScript packages and Rust tests for Tauri runtime modules.

Required coverage:

- domain schemas and enum invariants;
- local tool response envelope validation;
- authorization allowlists and write-scope checks;
- market-data freshness warnings;
- backtest strategy validation and metrics;
- prompt-injection warning detection;
- secret redaction helpers;
- remote-control message schemas.

### Integration Tests

Integration tests must run locally without hosted services.

Required coverage:

- SQLite migrations and repository behavior against a temporary database;
- local command client calling the Tauri command boundary or an equivalent test harness;
- local tool router with seeded profile, portfolio, watchlist, run, and audit data;
- stdio MCP adapter delegating to the local tool router with a signed run context;
- `CodexRunHost` with a mocked Codex SDK stream;
- backtest queue restart/resume behavior;
- remote-control pairing, revoke, stale session, and permission denial.

### E2E Tests

Use Playwright against `apps/web-preview` for fast webview-equivalent coverage.

Required MVP flows:

- portfolio and watchlist setup;
- start the BTC/NVDA portfolio review scenario;
- show run progress, risk warning, final run card, and artifacts;
- inspect run detail at desktop width;
- inspect mobile remote-control routes at phone width;
- confirm revoked mobile commands fail;
- confirm the app shows disconnected/stale state when the Mac host is unavailable.
- verify English and Korean locale smoke paths for host chrome, mobile chrome, remote state labels, and locale-aware formatting.

Tauri smoke tests must cover native-only behavior:

- secure storage access;
- local app data directory access;
- artifact file opening;
- remote-control pairing key persistence;
- mobile proof-of-capability checks from [Security, Compliance, And Risk Controls](./06-security-compliance-and-risk-controls.md).

## 5. Codex In-App Browser Design Verification

`apps/web-preview` is the canonical browser-inspectable development surface for Codex. It must share the same route components, command-client contracts, design tokens, charts, and layout primitives as the Tauri webview.

The web preview must support:

- deterministic seeded scenario mode;
- mocked command-client mode for UI-only E2E tests;
- local command-client mode for integration smoke checks;
- desktop viewport for macOS host routes;
- mobile viewport for remote-control routes;
- deterministic `?locale=` overrides for i18n QA;
- stable selectors for Playwright and Codex browser inspection;
- visible loading, empty, error, stale-data, risk-warning, and disconnected states.

For UI tasks, Codex must run `pnpm dev:web`, open the local preview in the Codex in-app browser, and verify at least:

- no incoherent text overlap;
- route content fits desktop and mobile viewports;
- risk warnings are visible and not hidden behind charts or cards;
- chart containers render nonblank content;
- primary actions remain reachable by keyboard and pointer;
- mobile remote-control layouts reflect connected, disconnected, and revoked states.
- language switching preserves runtime/remote query state and does not overlap compact mobile layouts.

Automated Playwright assertions should cover layout-critical states where possible. Browser inspection remains the final design check before calling a UI change complete.

## 6. Fixture And Seed Requirements

Create shared fixtures under:

```text
packages/test-fixtures/src/
  mvp-profile.ts
  instruments.ts
  portfolios.ts
  market-data.ts
  research-runs.ts
  remote-devices.ts
```

Fixtures must include:

- AAPL, NVDA, BTC, ETH, USDC, USD cash, SPY, QQQ;
- a "Core" portfolio with BTC and NVDA exposure;
- a default watchlist;
- market data with explicit freshness states;
- a run fixture for the required BTC/NVDA acceptance scenario;
- connected, stale, and revoked mobile device states.

Fixtures must be usable by Vitest, Playwright, Tauri smoke tests, and agent integration tests.

## 7. Codex Runtime Test Harness

`packages/agents` must provide a test harness that simulates Codex SDK behavior without calling real models by default:

```text
packages/agents/src/test-harness/
  mock-codex-sdk.ts
  scripted-run-stream.ts
  mock-structured-turn.ts
  btc-nvda-scenario.ts
```

The harness must prove:

- stage transitions are persisted;
- streamed Codex events map to `CodexRunEvent`;
- structured output is validated with Zod;
- invalid structured output records validation failure;
- cancellation archives or stops the run without corrupting persisted state;
- final run cards obey allowed recommendation categories.

Real Codex SDK smoke tests are optional for local development and must be gated behind an explicit environment variable such as `PLUTUS_RUN_REAL_CODEX_SMOKE=1`.

## 8. Completion Gates

No phase is complete until its local gate passes:

| Phase Area | Required Gate |
| --- | --- |
| Domain schemas | `pnpm --filter @plutus/domain test:unit` |
| Persistence | `pnpm test:persistence` |
| Local commands | `pnpm test:commands` |
| Market data and portfolio services | `pnpm --filter @plutus/data test:unit` and local-tools integration tests |
| Local tools and MCP adapter | `pnpm test:mcp` |
| Backtesting | `pnpm --filter @plutus/backtest test` |
| Agent runtime | `pnpm test:agent` |
| Remote control | `pnpm test:remote` |
| UI | `pnpm test:e2e:ui` plus Codex in-app browser inspection |
| MVP acceptance | `pnpm test:acceptance` plus required Tauri/mobile proof checks |

The repository-wide completion gate is:

```bash
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
pnpm test:acceptance
pnpm test:tauri
```

If a command cannot run in the current environment, Codex must record the exact blocker and the closest successful lower-level verification.

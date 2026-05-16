# Plutus Spec Index

This folder turns the PRD set in `prd/` into implementation-oriented design documents.

The specs define a local-first MVP architecture, package boundaries, data contracts, runtime flows, security constraints, and implementation order for a TypeScript-first Plutus app.

## Reading Order

1. [System Architecture](./00-system-architecture.md)
2. [Domain Model And Persistence](./01-domain-model-and-persistence.md)
3. [Agent Runtime And Run Lifecycle](./02-agent-runtime-and-run-lifecycle.md)
4. [Local Tool Surface](./03-local-tool-surface.md)
5. [Backtesting And Reports](./04-backtesting-and-reports.md)
6. [Apps, Local Commands, And Remote Control](./05-apps-local-commands-and-remote-control.md)
7. [Security, Compliance, And Risk Controls](./06-security-compliance-and-risk-controls.md)
8. [MVP Implementation Plan](./07-mvp-implementation-plan.md)

## Design Baseline

- Build Plutus as a pnpm/Turborepo TypeScript monorepo centered on a Tauri 2 macOS host app and mobile remote-control app.
- Keep MVP product state local to the Mac host with SQLite plus app-local artifact files.
- Use `@openai/codex-sdk` from the Mac host local runtime process, behind `CodexRunHost`.
- Use first-party local tools for market data, portfolio, backtest, risk, research, reports, memory, and audit access.
- Expose local tools to Codex through a Mac-hosted stdio MCP adapter; no hosted backend or network MCP service is required.
- Use Tauri 2 for the macOS host shell and iOS/Android remote-control shells.
- Exclude live trading from MVP. The only allowed MVP output categories are `observe`, `research_more`, `rebalance_candidate`, `strategy_candidate`, `risk_warning`, and `no_action`.

## Spec Coverage Map

| PRD | Covered By |
| --- | --- |
| `00-product-vision.md` | Architecture, agent lifecycle, reports, apps |
| `01-agent-team-requirements.md` | Agent runtime, local tool surface, implementation plan |
| `02-market-data-and-portfolio.md` | Domain model, local tool surface, apps/commands |
| `03-strategy-backtesting-and-shadow-account.md` | Backtesting/reports, domain model, implementation plan |
| `04-mac-and-mobile-apps.md` | Apps/local commands/remote control, architecture |
| `05-technical-stack.md` | Architecture, implementation plan |
| `06-security-compliance-and-risk.md` | Security controls, local tool surface, agent lifecycle |
| `07-roadmap-and-mvp-scope.md` | Implementation plan |
| `08-codex-sdk-agent-team-feasibility.md` | Agent runtime |
| `09-agent-mcp-map.md` | Local tool surface with MCP-compatible naming |

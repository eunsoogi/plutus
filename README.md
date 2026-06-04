<p align="center">
  <img alt="Node 22.13+" src="https://img.shields.io/badge/node-22.13%2B-339933?logo=node.js&amp;logoColor=white" />
  <img alt="pnpm 11.0.0" src="https://img.shields.io/badge/pnpm-11.0.0-F69220?logo=pnpm&amp;logoColor=white" />
  <img alt="TypeScript 5.8" src="https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&amp;logoColor=white" />
  <img alt="Tauri 2" src="https://img.shields.io/badge/Tauri-2-FFC131?logo=tauri&amp;logoColor=111111" />
  <img alt="MVP local-first" src="https://img.shields.io/badge/status-MVP%20local--first-5A67D8" />
</p>

<h1 align="center">Plutus</h1>

<p align="center">
  <a href="./README.ko.md">ko</a>
</p>

<p align="center">
  <img alt="Plutus README hero" src="./assets/readme/plutus-hero.png" />
</p>

Plutus is a local-first trading research workspace centered on a macOS host. It coordinates Codex-powered specialist agents for market research, portfolio review, backtesting, risk analysis, and report generation, while keeping the user in control of the final decision.

> The MVP boundary is explicit: Plutus is for research, simulation, and decision support. It does not place live orders or perform autonomous trading.

## Why Plutus

Most trading research tools force an uncomfortable tradeoff: evidence is scattered, automation becomes opaque, or portfolio and credential data depend too heavily on external services.

Plutus is designed in the opposite direction.

- **Local-first**: the macOS host owns SQLite state, local artifacts, audit logs, and the Codex runtime boundary.
- **Agent-team workflow**: researchers, data analysts, backtesters, risk reviewers, and reporters work as separate specialists.
- **Evidence-centered output**: every recommendation carries assumptions, data freshness, risk notes, source references, and a recommendation category.
- **Clear execution boundary**: MVP outputs are limited to observation, additional research, rebalance candidates, strategy candidates, risk warnings, and no-action calls.
- **Korean and English product support**: app chrome, reports, memory summaries, and wiki summaries share one locale contract.

## Product Surfaces

| Surface               | Description                                                                                                                           |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| macOS host app        | A Tauri 2 local app that owns portfolio state, Codex runtime, local tools, and the audit log.                                         |
| Web preview           | A browser development surface where Codex can verify UI and responsive layouts.                                                       |
| Mobile remote control | A paired controller and viewer for the Mac host, not an independent source-of-truth database.                                         |
| Local MCP adapter     | A stdio MCP surface that lets Codex agents safely call Plutus market data, portfolio, backtest, risk, report, memory, and wiki tools. |
| Memory and wiki       | A Plutus-owned memory adapter and local Markdown wiki keep long-running research context auditable.                                   |

## Project Docs

- [Development](./docs/development.md)
- [Architecture](./docs/architecture.md)
- [Agent workflow](./AGENTS.md)

## Current Status

Plutus is an MVP-stage repository. The first priority is research, simulation, and decision support. Live trade execution remains out of scope until that boundary is explicitly opened.

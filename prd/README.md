# Plutus PRD Index

This folder contains requirement-level PRDs for Plutus, a TypeScript-first multi-agent portfolio workspace for crypto and stock research, simulation, and portfolio management.

## Reading Order

1. [Product Vision](./00-product-vision.md)
2. [Agent Team Requirements](./01-agent-team-requirements.md)
3. [Market Data And Portfolio Management](./02-market-data-and-portfolio.md)
4. [Strategy, Backtesting, And Shadow Account](./03-strategy-backtesting-and-shadow-account.md)
5. [macOS And Mobile Apps](./04-mac-and-mobile-apps.md)
6. [Technical Stack Recommendation](./05-technical-stack.md)
7. [Security, Compliance, And Financial Risk Boundaries](./06-security-compliance-and-risk.md)
8. [Roadmap And MVP Scope](./07-roadmap-and-mvp-scope.md)
9. [Codex SDK Agent Team Feasibility](./08-codex-sdk-agent-team-feasibility.md)
10. [Agent MCP Map](./09-agent-mcp-map.md)

## Core Decisions

- Use TypeScript across agent orchestration, macOS host, mobile remote-control app, and shared domain packages.
- Use the OpenAI Codex SDK TypeScript package, `@openai/codex-sdk`, as the primary agent-control layer, isolated behind a Plutus `CodexRunHost` adapter.
- Implement the finance agent team through Codex threads, project-scoped `.codex/agents/*.toml` custom agents, Codex subagent prompts, MCP domain tools, streamed events, and structured output schemas.
- Restrict each finance custom agent to an explicit local tool allowlist: market data, portfolio, backtest, risk, research, reports, memory, and audit namespaces are separated by responsibility.
- Borrow Vibe-Trading's strongest concepts: plan-ground-execute-validate-deliver runs, specialist agent teams, research memory, backtests, run cards, Phase 2 Shadow Account analysis, and no live trading in MVP.
- Use Tauri 2 as the shared app shell, with macOS as the deep research workstation and source-of-truth host, and mobile as a paired remote-control surface for the Mac app.
- Start with research, portfolio management, and simulation. Reserve live trading for a separate future PRD.

# Plutus PRD: Roadmap And MVP Scope

## 1. MVP Scope

MVP should prove the core loop:

1. User creates a portfolio and watchlist.
2. User asks a natural-language research question.
3. Agent team gathers data and runs analysis.
4. Risk manager validates the output.
5. System returns an auditable run card and report.
6. User can view and control the same Mac-hosted result from mobile through a paired remote-control session.

## 2. MVP Features

- TypeScript monorepo scaffold.
- Shared domain models and Zod schemas.
- Local app command layer with portfolio, watchlist, instrument, and research-run resources.
- OpenAI Codex SDK agent host with specialist role workflows.
- Project-scoped Codex custom agent files for market data, equity, crypto, quant, technical, portfolio, risk, and report roles.
- Project-scoped LLM Wiki Curator custom agent for autonomous knowledge-base maintenance.
- `CodexRunHost` adapter with start, stream, resume, structured-turn, and archive capabilities.
- Market data adapters for US equities/ETFs and major crypto.
- Manual portfolio entry.
- Watchlists.
- Basic strategy spec generation.
- Basic long-only backtesting for single-asset and simple multi-asset strategies.
- Risk summary and recommendation category.
- Run cards and report artifacts.
- English and Korean interface/report localization with locale-aware number, currency, date, and time-zone formatting.
- Mem0-backed runtime memory adapter with automatic capture, recall, edit, archive, delete, and category controls.
- Local Markdown wiki with autonomous LLM Wiki Curator updates, source-linked revision history, activity feed, and revert controls.
- macOS host app with research workspace, local data store, Codex runtime, and remote-control service.
- Mobile remote-control app with portfolio summary, watchlist, run history, run composer controls, and artifact viewer backed by the Mac host.
- Connected in-app remote-control run events and completion notifications while the mobile controller is paired and online.
- Pairing, encrypted remote-control session, connected-device list, and revoke controls.

## 3. Phase 2

- CSV trade import.
- Shadow Account behavior report.
- More robust backtest validation.
- Additional locales beyond English and Korean, plus translation QA workflows for expanded market terminology.
- Provider health and failover dashboard.
- Richer notification preferences and notification history.
- Read-only exchange/broker portfolio import.
- Mobile push notifications through platform services after a separate notification design.
- Advanced persistent agent memory controls.
- Wiki contradiction review and periodic knowledge-base maintenance.

## 4. Phase 3

- Paper portfolio simulation.
- Options and derivatives research.
- Advanced portfolio optimizer.
- Walk-forward and bootstrap validation.
- On-chain data integrations.
- MCP plugin surface for external agent clients.
- Strategy export formats.

## 5. Phase 4

- Live trading PRD, if pursued.
- Compliance review.
- Broker/exchange write integrations.
- Approval workflow, kill switch, and order audit.

## 6. Open Questions

- Which market region matters first after US stocks and crypto: Korean equities, Hong Kong equities, or global ETFs?
- Which broker/exchange integrations are most important for read-only import?
- Which remote-control transport should be used first: local-network encrypted WebSocket, WebRTC data channel, or a Tauri-supported native transport?

## 7. Definition Of Done For PRD Phase

- Requirement documents exist under `prd/`.
- Each requirement area has objective, scope, requirements, and acceptance criteria.
- Technical stack recommendation is explicit.
- Vibe-Trading concepts are translated into Plutus-specific requirements.
- MVP excludes live trading and reserves it for a separate PRD.

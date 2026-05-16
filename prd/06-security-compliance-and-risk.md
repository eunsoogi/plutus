# Plutus PRD: Security, Compliance, And Financial Risk Boundaries

## 1. Objective

Protect users from unsafe financial automation, data leakage, prompt injection, and misleading agent outputs. Plutus must be designed as research and decision support first, with clear controls before any future trading capability.

## 2. Financial Boundary

MVP must:

- State that outputs are research assistance, not guaranteed financial advice.
- Avoid direct live trading execution.
- Require user approval for any future broker/exchange write action.
- Mark all recommendations as observe, research more, rebalance candidate, strategy candidate, risk warning, or no-action.
- Show assumptions, data freshness, and risk caveats.

## 3. Agent Safety Guardrails

Guardrails must detect and block or warn on:

- Requests for guaranteed returns.
- Attempts to bypass risk review.
- Instructions to hide losses, warnings, or uncertainty.
- Prompt injection in uploaded files, URLs, or copied text.
- Tool calls requesting unavailable live-trading permissions.
- Leverage, margin, derivatives, illiquid markets, and concentrated positions without enhanced warnings.

## 4. Data Security

Sensitive data:

- Portfolio holdings.
- Broker/exchange credentials.
- API keys.
- Trade history.
- Research notes.
- Generated strategy code.

Requirements:

- Encrypt sensitive data at rest.
- Use platform secure storage for client secrets.
- Keep provider secrets out of model-visible context.
- Redact secrets from traces and logs.
- Store audit logs for agent run inputs, tool calls, and output artifacts.
- Support account deletion and export.

## 5. Prompt Injection And Tool Security

Uploaded documents, URLs, news, and broker exports must be treated as untrusted.

Requirements:

- Separate untrusted content from system/developer instructions.
- Summarize untrusted content before passing it into decision agents.
- Add source-level warnings when content asks the agent to ignore rules or leak secrets.
- Restrict file access to approved workspace paths.
- Run generated strategy code in sandboxed execution.
- Disable shell access for ordinary research agents.

## 6. Future Broker/Exchange Integration Boundary

Phase 1:

- Manual portfolio entry.
- CSV imports.

Phase 2:

- Read-only broker/exchange sync.

Phase 3:

- Paper portfolio simulation.

Phase 4:

- Live trading only after separate compliance, security, and approval PRD.

Live trading must require:

- Explicit user approval per order.
- Pre-trade risk check.
- Position limit.
- Kill switch.
- Full audit trail.
- Exchange/broker permission scoping.

## 7. Acceptance Criteria

- Agent refuses to execute or simulate a hidden high-leverage trade as a guaranteed profit.
- Uploaded prompt-injection text is flagged and does not override system rules.
- Backtest reports show that past performance does not guarantee future returns.
- Traces and logs do not contain raw API keys.
- Generated code runs only in a sandboxed context.

# Plutus Design System

## 1. Design Direction

Plutus uses an operational trading-desk interface: dense, calm, inspectable, and built for repeated decisions. The visual model is closer to a risk terminal than a finance landing page.

Lazyweb research references used for this direction:

- Coinbase exchange/API pages: dark trading surfaces with chart-first context and developer/API clarity.
- Public API trading page: API-key connection, paper trading, logs, and order eligibility.
- Webull paper trading: explicit risk-free practice mode with trading dashboards.
- Schwab/Thinkorswim and Fidelity: platform comparison, dense tool navigation, and clear account actions.
- Compliance/risk dashboards: audit-proof approvals, risk controls, and status summaries.

## 2. Principles

- Status before action: show provider health, permissions, and mode before order controls.
- Dry-run first: paper execution is the default path, with live trading visibly gated.
- Evidence density: compact tables, chips, and panels are preferred over oversized hero layouts.
- Inspectable automation: agent decisions expose dissent, risk checks, and payloads.
- Local-first trust: credential state is represented by opaque secure refs, never raw secrets.

## 3. Visual Tokens

Use the existing dark terminal palette and extend it sparingly:

- background: deep graphite;
- panel: near-black blue-gray;
- border: low-contrast blue-gray;
- accent: cyan for active data/selection;
- success: green for healthy/dry-run accepted;
- warning: amber for degraded/review-needed;
- danger: red for blocked/live-risk states.

Cards keep an `8px` maximum radius. Button text must not overflow; icon-only controls should be used for compact toolbar actions when a suitable icon library exists.

## 4. Component Patterns

- Provider Card: display name, market, environment, mode, health, permissions, last check.
- Permission Chips: small labels for `market_data`, `account_read`, `trade_dry_run`, `trade_live`.
- Mode Control: segmented select for `disabled`, `read_only`, `dry_run`, `live_requires_approval`.
- Decision Composer: provider, symbol, side, order type, quantity, limit price, and rationale.
- Consensus Panel: bull, bear, risk, execution viewpoints and final action.
- Audit Payload: monospace JSON block for provider-specific dry-run payloads.

## 5. Layout

Desktop provider settings use a two-column workbench:

- left: provider cards and connection/permission state;
- right: decision composer and dry-run audit result.

Mobile collapses to a single column with provider cards first, then decision composer. Primary action remains visible without horizontal scrolling.

## 6. Content Rules

- Say “Dry-run” instead of “Trade” for simulated execution.
- Say “Live requires approval” instead of “Live enabled” unless the full live gate exists.
- Never imply broker/exchange confirmation for a Plutus dry-run result.
- Put provider limitations next to the provider, not hidden in documentation.

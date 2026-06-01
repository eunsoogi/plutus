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

- Status before action: show venue health, permissions, and mode before order controls.
- Dry-run first: paper execution is the default path, with live trading visibly gated.
- Evidence density: compact tables, chips, and panels are preferred over oversized hero layouts.
- Inspectable automation: agent decisions expose dissent, risk checks, and payloads.
- Local-first trust: setup forms may accept credentials, but saved provider state displays opaque secure refs and clears raw secrets from the screen.

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

- Trading Venue Selector: searchable CCXT catalog plus pinned Kiwoom entry, with compact status cards for matching venues.
- Permission Chips: small labels for `market_data`, `account_read`, `trade_dry_run`, `trade_live`.
- Mode Control: segmented select for `disabled`, `read_only`, `dry_run`, `live_requires_approval`.
- Credential Setup Form: API key/app key, secret key, optional passphrase, and account/label fields with a generated `secure://plutus/...` storage ref preview; raw values are cleared after save.
- Decision Composer: trading venue, symbol, side, order type, quantity, limit price, and rationale.
- Consensus Panel: bull, bear, risk, execution viewpoints and final action.
- Audit Payload: monospace JSON block for provider-specific dry-run payloads.

## 5. Layout

Desktop provider settings use a dense two-row operations console sized for the default app window:

- top-left: searchable trading venue catalog and health summary;
- top-right: setup checklist, credential form, generated storage ref, mode, and permission state;
- bottom: order composer plus decision/payload preview.

Mobile collapses to a single column with venue search first, then setup, then decision composer. Long catalogs scroll inside their panel, not at the document level on desktop.

## 6. Content Rules

- Say “Dry-run” instead of “Trade” for simulated execution.
- Say “Live requires approval” instead of “Live enabled” unless the full live gate exists.
- Never imply broker/exchange confirmation for a Plutus dry-run result.
- Put provider limitations next to the provider, not hidden in documentation.

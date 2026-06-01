# Plutus PRD: Trading Provider Decision Support

## 1. Objective

Enable Plutus to configure Kiwoom Securities plus every CCXT-supported exchange as trading venues, then use Codex multi-agent decision support to produce inspectable dry-run order recommendations.

This PRD upgrades provider setup and paper execution readiness without weakening the MVP safety boundary. Live execution remains disabled until a separate approval workflow, order audit, and compliance review are shipped.

## 2. Scope

Included:

- Provider configuration UI for Kiwoom and the current CCXT exchange catalog.
- Provider capability, environment, permission, and health status display.
- Dry-run order preview for stocks and spot crypto.
- Multi-agent trading decision package with bull, bear, risk, and execution viewpoints.
- Kiwoom-specific and CCXT `createOrder` payload mapping for order preview and audit.
- Clear separation of read-only data, dry-run trading, and future live trading.

Excluded from this PRD:

- Autonomous live order placement.
- High-frequency or latency-sensitive execution.
- Margin, derivatives, futures, options, lending, staking, or leverage workflows.
- Tax, legal, or jurisdiction-specific advice.
- Persistent raw credential storage in browser preview or agent memory.

## 3. Supported Trading Venues

| Venue family | Primary Market | Initial Mode | Notes |
| --- | --- | --- | --- |
| Kiwoom | Korean equities | dry-run | Uses REST/OpenAPI concepts with mock and production domains tracked separately. |
| CCXT exchanges | Crypto spot / derivatives | dry-run | Uses the official CCXT exchange id catalog, including Upbit, Coinbase, Binance, Kraken, OKX, Bybit, and other supported exchanges. |

## 4. User Experience

The `/settings/providers` screen must behave like an operations console, not a marketing page:

- Show each trading venue as a compact searchable selector with market, environment, permissions, health, and last check.
- Display a setup checklist that explains exchange selection, credential field entry, generated secure reference handling, and dry-run/live approval mode.
- Make dry-run the default and safest active state.
- Surface missing live permissions as blocked, not hidden.
- Provide one decision panel where the user can choose provider, symbol, side, type, quantity, and optional limit price.
- Show the multi-agent consensus before any dry-run submission.
- Keep order payloads inspectable: Kiwoom uses its own preview endpoint, while CCXT venues use a generic dry-run `createOrder` payload.

## 5. Multi-Agent Decision Contract

Every trading decision package includes:

- requested order intent;
- selected provider and configured permissions;
- bull case;
- bear case;
- risk manager view;
- execution specialist view;
- final action: `dry_run_allowed`, `needs_review`, `blocked`, or `live_requires_approval`;
- confidence;
- blocking reasons;
- evidence refs;
- audit refs.

The final decision cannot authorize live execution unless all of these are true:

- provider live mode is enabled;
- provider has `trade_live` permission;
- user approval has been recorded for the exact order intent;
- risk manager does not veto the action;
- kill switch is not active.

## 6. Acceptance Criteria

- User can open `/settings/providers` and see Kiwoom plus the full current CCXT exchange catalog.
- User can search/select CCXT exchanges and enter API key, secret, optional passphrase, and account/label fields.
- Saved provider state clears raw credential fields from the screen and keeps only a generated `secure://plutus/...` reference.
- User can save provider mode/permission settings in browser preview local runtime.
- User can generate a dry-run trading decision for each provider family.
- User can submit a dry-run order and inspect Kiwoom or CCXT payload fields.
- UI labels and state make clear that live execution is disabled without approval.
- Tests cover provider schemas, provider payload adapters, decision orchestration, command-client contracts, and UI behavior.

## 7. Source Notes

- CCXT package/docs: `ccxt.exchanges` is the source of supported exchange ids; non-Kiwoom crypto venues map to dry-run `createOrder` intent payloads.
- Kiwoom REST API guide: production and mock domains, OAuth token flow, and domestic stock order categories.

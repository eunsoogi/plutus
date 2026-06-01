# Plutus PRD: Trading Provider Decision Support

## 1. Objective

Enable Plutus to configure Kiwoom, Upbit, Coinbase, and Binance as trading providers, then use Codex multi-agent decision support to produce inspectable dry-run order recommendations.

This PRD upgrades provider setup and paper execution readiness without weakening the MVP safety boundary. Live execution remains disabled until a separate approval workflow, order audit, and compliance review are shipped.

## 2. Scope

Included:

- Provider configuration UI for Kiwoom, Upbit, Coinbase, and Binance.
- Provider capability, environment, permission, and health status display.
- Dry-run order preview for stocks and spot crypto.
- Multi-agent trading decision package with bull, bear, risk, and execution viewpoints.
- Provider-specific payload mapping for order preview and audit.
- Clear separation of read-only data, dry-run trading, and future live trading.

Excluded from this PRD:

- Autonomous live order placement.
- High-frequency or latency-sensitive execution.
- Margin, derivatives, futures, options, lending, staking, or leverage workflows.
- Tax, legal, or jurisdiction-specific advice.
- Provider credential collection in plain text fields.

## 3. Supported Providers

| Provider | Primary Market | Initial Mode | Notes |
| --- | --- | --- | --- |
| Kiwoom | Korean equities | dry-run | Uses REST/OpenAPI concepts with mock and production domains tracked separately. |
| Upbit | Spot crypto | dry-run | Region-specific base URLs and order-placement permission are surfaced. |
| Coinbase | Spot crypto | dry-run | Uses Advanced Trade order concepts and client order IDs. |
| Binance | Spot crypto | dry-run | Uses Spot order and test-order concepts with explicit signature requirement. |

## 4. User Experience

The `/settings/providers` screen must behave like an operations console, not a marketing page:

- Show each provider as a compact status card with market, environment, permissions, health, and last check.
- Make dry-run the default and safest active state.
- Surface missing live permissions as blocked, not hidden.
- Provide one decision panel where the user can choose provider, symbol, side, type, quantity, and optional limit price.
- Show the multi-agent consensus before any dry-run submission.
- Keep order payloads inspectable and provider-specific.

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

- User can open `/settings/providers` and see Kiwoom, Upbit, Coinbase, and Binance.
- User can save provider mode/permission settings in browser preview local runtime.
- User can generate a dry-run trading decision for each provider family.
- User can submit a dry-run order and inspect provider-specific payload fields.
- UI labels and state make clear that live execution is disabled without approval.
- Tests cover provider schemas, provider payload adapters, decision orchestration, command-client contracts, and UI behavior.

## 7. Source Notes

- Upbit Developer Center Create Order: region-specific `POST /v1/orders`, order-placement permission, and self-match prevention fields.
- Coinbase Advanced Trade Create Order: `POST /api/v3/brokerage/orders`, `client_order_id`, `product_id`, `side`, and `order_configuration`.
- Binance Spot API New Order: `POST /api/v3/order` and `POST /api/v3/order/test` for validating without matching-engine submission.
- Kiwoom REST API guide: production and mock domains, OAuth token flow, and domestic stock order categories.

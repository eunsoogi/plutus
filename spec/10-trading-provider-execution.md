# Plutus Spec: Trading Provider Execution Boundary

## 1. Goal

Specify the safe provider configuration, dry-run order, and multi-agent decision support path for Kiwoom, Upbit, Coinbase, and Binance.

The implementation must make provider-specific order payloads inspectable while keeping live execution blocked unless a future approval workflow explicitly enables it.

## 2. Domain Model

Trading provider records use:

- `providerId`: `kiwoom`, `upbit`, `coinbase`, or `binance`;
- `displayName`;
- `market`;
- `region`;
- `environment`: `mock`, `sandbox`, `paper`, or `live`;
- `mode`: `disabled`, `read_only`, `dry_run`, or `live_requires_approval`;
- `permissions`: `market_data`, `account_read`, `trade_dry_run`, `trade_live`;
- `health`: `connected`, `degraded`, `not_configured`, or `blocked`;
- `lastCheckedAt`;
- `credentialRef`: opaque `secure://` reference only.

Order intent records use:

- `providerId`;
- `symbol`;
- `side`: `buy` or `sell`;
- `orderType`: `market` or `limit`;
- `quantity`;
- optional `limitPrice`;
- `quoteCurrency`;
- `portfolioId`;
- `rationale`;

Dry-run order results use:

- generated order ID;
- provider ID;
- status: `accepted`, `blocked`, or `needs_approval`;
- provider payload;
- warnings;
- audit refs;
- `liveReady: false` by default.

## 3. Provider Payload Mapping

Kiwoom:

- map `buy`/`sell` to domestic-stock order side labels;
- preserve `symbol`, quantity, and optional limit price;
- include `endpoint: /api/dostk/ordr`;
- use production domain only when live mode is approved; mock domain otherwise.

Upbit:

- map provider symbol to market format such as `SGD-BTC`, `KRW-BTC`, or `USDT-BTC`;
- map side to `bid` or `ask`;
- map `market` order to `price` for buy or `volume` for sell;
- map `limit` order to `ord_type: limit`, `volume`, and `price`;
- include optional client identifier.

Coinbase:

- map provider symbol to product ID such as `BTC-USD`;
- map side to `BUY` or `SELL`;
- place quantity and price data under `order_configuration`;
- include `client_order_id`.

Binance:

- map symbol to exchange pair such as `BTCUSDT`;
- map side to `BUY` or `SELL`;
- map order type to `MARKET` or `LIMIT`;
- use `/api/v3/order/test` for dry-run validation concepts;
- include `newClientOrderId`.

## 4. Command Surface

The browser-preview command bridge must support:

```ts
providers.list(): Promise<TradingProviderConfig[]>
providers.save(input: TradingProviderConfig): Promise<TradingProviderConfig>
trading.previewDecision(input: TradingOrderIntent): Promise<TradingDecision>
trading.submitDryRunOrder(input: TradingOrderIntent): Promise<DryRunOrderResult>
```

Native Tauri persistence may follow in a later implementation wave, but the command contract must redact secret-like fields and never expose raw credentials.

## 5. UI Requirements

`/settings/providers` renders:

- provider status cards;
- permission chips;
- segmented environment/mode controls;
- provider health summary;
- decision composer;
- multi-agent consensus panel;
- dry-run order preview and audit result.

The UI must keep all controls reachable on desktop and mobile-width web preview. Live execution copy must always state that user approval, risk validation, and audit are required.

## 6. Agent Decision Rules

Trading decisions are deterministic in local tests and structured for future Codex runtime use.

The decision engine must:

- block disabled providers;
- block missing `trade_dry_run` permission for dry-run submissions;
- require review for degraded provider health;
- require review for orders without a rationale;
- block live execution unless the future live gate is satisfied;
- include bull, bear, risk, and execution viewpoints.

## 7. Safety Invariants

- Raw provider secrets are never stored in local browser runtime.
- Live execution is never performed by browser preview.
- Dry-run order results are audit artifacts, not broker/exchange confirmations.
- Risk manager veto changes final action to `blocked` or `needs_review`.
- Provider payload builders must be covered by unit tests.

## 8. Verification

Required local gates:

- `pnpm --filter @plutus/domain test:unit`
- `pnpm --filter @plutus/data test:unit`
- `pnpm --filter @plutus/agents test:unit`
- `pnpm --filter @plutus/command-client test`
- `pnpm --filter @plutus/web-preview test`
- `pnpm test:e2e:ui`

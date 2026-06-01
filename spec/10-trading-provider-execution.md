# Plutus Spec: Trading Provider Execution Boundary

## 1. Goal

Specify the safe provider configuration, dry-run order, and multi-agent decision support path for Kiwoom Securities plus the current CCXT-supported exchange catalog.

The implementation must make Kiwoom and CCXT dry-run payloads inspectable while keeping live execution blocked unless a future approval workflow explicitly enables it.

## 2. Domain Model

Trading provider records use:

- `providerId`: `kiwoom` or an official lower-case CCXT exchange id;
- `displayName`;
- `market`;
- `region`;
- `environment`: `mock`, `sandbox`, `paper`, or `live`;
- `mode`: `disabled`, `read_only`, `dry_run`, or `live_requires_approval`;
- `permissions`: `market_data`, `account_read`, `trade_dry_run`, `trade_live`;
- `health`: `connected`, `degraded`, `not_configured`, or `blocked`;
- `lastCheckedAt`;
- `credentialRef`: generated opaque `secure://` reference stored on the provider record.

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

CCXT exchanges:

- include `endpoint: ccxt://{exchangeId}/createOrder`;
- preserve the official CCXT lower-case exchange id in `exchange`;
- normalize `BTC-USDT` style pairs to `BTC/USDT` while preserving already slash-delimited symbols;
- map `side`, `orderType`, quantity, optional limit price, and client order id into a dry-run `createOrder` payload;
- keep `dryRun: true` in payload metadata and do not call the real exchange from browser preview.

## 4. Command Surface

The browser-preview command bridge must support:

```ts
providers.list(): Promise<TradingProviderConfig[]>
providers.save(input: TradingProviderConfig): Promise<TradingProviderConfig>
trading.previewDecision(input: {
  provider: TradingProviderConfig
  intent: TradingOrderIntent
}): Promise<TradingDecision>
trading.submitDryRunOrder(input: {
  provider: TradingProviderConfig
  intent: TradingOrderIntent
  decision?: TradingDecision
}): Promise<DryRunOrderResult>
```

Native Tauri persistence may follow in a later implementation wave. The browser-preview UI may accept credential field input during setup, but the command contract stores only the generated secure reference and clears raw field values after save.

## 5. UI Requirements

`/settings/providers` renders:

- searchable trading venue selector backed by Kiwoom plus the CCXT exchange catalog;
- setup checklist for exchange selection, credential field entry, generated secure reference handling, and dry-run/live mode;
- credential setup form with API key/app key, secret key, optional passphrase, and account/label fields;
- permission chips;
- segmented environment/mode controls;
- provider health summary;
- decision composer;
- multi-agent consensus panel;
- dry-run order preview and audit result.

The UI must keep all controls reachable on desktop and mobile-width web preview. Desktop provider settings should fit the default app window without document-level scrolling; long exchange catalogs use internal scrolling. Live execution copy must always state that user approval, risk validation, and audit are required.

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
- Raw provider secret inputs are cleared from the React form after provider settings are saved.
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

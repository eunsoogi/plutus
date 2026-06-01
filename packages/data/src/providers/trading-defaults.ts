import {
  CCXT_EXCHANGE_IDS,
  TradingProviderConfigSchema,
  ccxtExchangeDisplayName,
  makeWarning,
  type TradingProviderConfig,
} from "@plutus/domain";

export function createDefaultTradingProviderConfigs(
  now: string,
): TradingProviderConfig[] {
  return [
    TradingProviderConfigSchema.parse({
      providerId: "kiwoom",
      displayName: "Kiwoom Securities",
      market: "Korean equities",
      region: "KR",
      environment: "mock",
      mode: "dry_run",
      permissions: ["market_data", "account_read", "trade_dry_run"],
      health: "not_configured",
      lastCheckedAt: now,
      credentialRef: null,
      warnings: [
        makeWarning(
          "kiwoom_local_runtime_required",
          "warning",
          "Kiwoom live access must remain inside the Mac host runtime.",
        ),
      ],
    }),
    ...CCXT_EXCHANGE_IDS.map((exchangeId) =>
      TradingProviderConfigSchema.parse({
        providerId: exchangeId,
        displayName: ccxtExchangeDisplayName(exchangeId),
        market: "Spot crypto / derivatives via CCXT",
        region: "CCXT",
        environment: "sandbox",
        mode: "dry_run",
        permissions: ["market_data", "account_read", "trade_dry_run"],
        health: "not_configured",
        lastCheckedAt: now,
        credentialRef: null,
        warnings: [],
      }),
    ),
  ];
}

export const defaultTradingProviderConfigs =
  createDefaultTradingProviderConfigs("2026-06-02T00:00:00.000Z");

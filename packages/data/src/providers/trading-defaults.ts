import {
  TradingProviderConfigSchema,
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
    TradingProviderConfigSchema.parse({
      providerId: "upbit",
      displayName: "Upbit",
      market: "Spot crypto",
      region: "KR/SG/ID/TH",
      environment: "sandbox",
      mode: "dry_run",
      permissions: ["market_data", "account_read", "trade_dry_run"],
      health: "not_configured",
      lastCheckedAt: now,
      credentialRef: null,
      warnings: [],
    }),
    TradingProviderConfigSchema.parse({
      providerId: "coinbase",
      displayName: "Coinbase Advanced Trade",
      market: "Spot crypto",
      region: "US/global",
      environment: "sandbox",
      mode: "dry_run",
      permissions: ["market_data", "account_read", "trade_dry_run"],
      health: "not_configured",
      lastCheckedAt: now,
      credentialRef: null,
      warnings: [],
    }),
    TradingProviderConfigSchema.parse({
      providerId: "binance",
      displayName: "Binance Spot",
      market: "Spot crypto",
      region: "Global",
      environment: "sandbox",
      mode: "dry_run",
      permissions: ["market_data", "account_read", "trade_dry_run"],
      health: "not_configured",
      lastCheckedAt: now,
      credentialRef: null,
      warnings: [],
    }),
  ];
}

export const defaultTradingProviderConfigs =
  createDefaultTradingProviderConfigs("2026-06-02T00:00:00.000Z");

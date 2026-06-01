import { describe, expect, it } from "vitest";

import {
  DryRunOrderResultSchema,
  TradingDecisionSchema,
  TradingOrderIntentSchema,
  TradingProviderConfigSchema,
} from "./schema";

const now = "2026-06-02T00:00:00.000Z";

describe("trading provider domain schemas", () => {
  it("parses provider configuration without accepting raw secrets", () => {
    const provider = TradingProviderConfigSchema.parse({
      providerId: "upbit",
      displayName: "Upbit",
      market: "Spot crypto",
      region: "SG",
      environment: "sandbox",
      mode: "dry_run",
      permissions: ["market_data", "account_read", "trade_dry_run"],
      health: "connected",
      lastCheckedAt: now,
      credentialRef: "secure://plutus/providers/upbit/main",
      warnings: [],
    });

    expect(provider.providerId).toBe("upbit");
    expect(provider.permissions).toContain("trade_dry_run");
    expect(
      TradingProviderConfigSchema.safeParse({
        ...provider,
        credentialRef: "sk-live-secret",
      }).success,
    ).toBe(false);
  });

  it("accepts CCXT exchange ids outside the original curated set", () => {
    const provider = TradingProviderConfigSchema.parse({
      providerId: "kraken",
      displayName: "Kraken",
      market: "Spot crypto",
      region: "CCXT",
      environment: "sandbox",
      mode: "dry_run",
      permissions: ["market_data", "account_read", "trade_dry_run"],
      health: "not_configured",
      lastCheckedAt: now,
      credentialRef: null,
      warnings: [],
    });

    expect(provider.providerId).toBe("kraken");
    expect(
      TradingOrderIntentSchema.safeParse({
        providerId: "okx",
        symbol: "BTC/USDT",
        side: "buy",
        orderType: "market",
        quantity: 0.1,
        quoteCurrency: "USDT",
      }).success,
    ).toBe(true);
  });

  it("requires limit prices only for limit order intents", () => {
    expect(
      TradingOrderIntentSchema.safeParse({
        providerId: "coinbase",
        symbol: "BTC-USD",
        side: "buy",
        orderType: "limit",
        quantity: 0.1,
        limitPrice: 67000,
        quoteCurrency: "USD",
        rationale: "Dry-run entry test.",
      }).success,
    ).toBe(true);

    expect(
      TradingOrderIntentSchema.safeParse({
        providerId: "coinbase",
        symbol: "BTC-USD",
        side: "buy",
        orderType: "limit",
        quantity: 0.1,
        quoteCurrency: "USD",
        rationale: "Missing limit price.",
      }).success,
    ).toBe(false);
  });

  it("validates decision and dry-run order result artifacts", () => {
    const intent = TradingOrderIntentSchema.parse({
      providerId: "binance",
      symbol: "BTCUSDT",
      side: "buy",
      orderType: "market",
      quantity: 0.01,
      quoteCurrency: "USDT",
      rationale: "Probe dry-run pathway.",
    });
    const provider = TradingProviderConfigSchema.parse({
      providerId: "binance",
      displayName: "Binance",
      market: "Spot crypto",
      region: "Global",
      environment: "sandbox",
      mode: "dry_run",
      permissions: ["market_data", "trade_dry_run"],
      health: "connected",
      lastCheckedAt: now,
      credentialRef: null,
      warnings: [],
    });
    const decision = TradingDecisionSchema.parse({
      decisionId: "decision-binance-btc",
      provider,
      intent,
      finalAction: "dry_run_allowed",
      confidence: "high",
      agentViews: [
        {
          role: "risk_manager",
          stance: "support",
          summary: "Dry-run only and position size is small.",
        },
      ],
      blockingReasons: [],
      evidenceRefs: ["provider:binance"],
      warnings: [],
      approvalRequired: false,
      createdAt: now,
    });

    expect(
      DryRunOrderResultSchema.parse({
        orderId: "dry-run-binance-btc",
        providerId: "binance",
        status: "accepted",
        liveReady: false,
        providerPayload: { endpoint: "/api/v3/order/test" },
        warnings: [],
        auditRefs: ["audit:dry-run-binance-btc"],
        decision,
        createdAt: now,
      }).status,
    ).toBe("accepted");
  });
});

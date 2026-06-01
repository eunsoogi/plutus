import { TradingProviderConfigSchema } from "@plutus/domain";

import {
  createTradingProviderService,
  defaultTradingProviderConfigs,
} from "../providers/trading";

function requireProvider(
  providerId: (typeof defaultTradingProviderConfigs)[number]["providerId"],
) {
  const provider = defaultTradingProviderConfigs.find(
    (candidate) => candidate.providerId === providerId,
  );
  if (!provider) throw new Error(`Missing provider fixture ${providerId}`);
  return provider;
}

describe("@plutus/data trading provider registry", () => {
  it("lists Kiwoom, Upbit, Coinbase, and Binance dry-run capable providers", () => {
    const service = createTradingProviderService();

    expect(service.listProviders().map((provider) => provider.providerId)).toEqual(
      ["kiwoom", "upbit", "coinbase", "binance"],
    );
    expect(
      service
        .listProviders()
        .every((provider) => provider.permissions.includes("trade_dry_run")),
    ).toBe(true);
  });

  it("creates a dry-run preview without credentials or network calls", () => {
    const service = createTradingProviderService();

    const result = service.previewOrder({
      providerId: "binance",
      symbol: "BTCUSDT",
      side: "buy",
      orderType: "market",
      quantity: 0.01,
      quoteCurrency: "USDT",
      rationale: "Dry-run only before any user-approved trade path.",
    });

    expect(result.status).toBe("accepted");
    expect(result.liveReady).toBe(false);
    expect(result.providerPayload).toMatchObject({
      endpoint: "/api/v3/order/test",
      mode: "dry_run",
    });
    expect(result.decision.finalAction).toBe("dry_run_allowed");
    expect(result.decision.approvalRequired).toBe(false);
  });

  it("blocks live previews unless credentials and explicit live permission exist", () => {
    const liveBinance = TradingProviderConfigSchema.parse({
      ...requireProvider("binance"),
      mode: "live_requires_approval",
      environment: "live",
      permissions: ["market_data", "trade_live"],
      credentialRef: null,
    });
    const service = createTradingProviderService({
      providerConfigs: [liveBinance],
    });

    const result = service.previewOrder({
      providerId: "binance",
      symbol: "BTCUSDT",
      side: "sell",
      orderType: "limit",
      quantity: 0.01,
      limitPrice: 70000,
      quoteCurrency: "USDT",
      rationale: "Live path should be blocked without secure credentials.",
    });

    expect(result.status).toBe("blocked");
    expect(result.decision.finalAction).toBe("blocked");
    expect(result.warnings).toContainEqual(
      expect.objectContaining({ code: "live_credentials_missing" }),
    );
  });

  it("keeps credentialed live providers approval-gated instead of executable", () => {
    const liveCoinbase = TradingProviderConfigSchema.parse({
      ...requireProvider("coinbase"),
      mode: "live_requires_approval",
      environment: "live",
      permissions: ["market_data", "account_read", "trade_live"],
      credentialRef: "secure://plutus/providers/coinbase/main",
    });
    const service = createTradingProviderService({
      providerConfigs: [liveCoinbase],
    });

    const result = service.previewOrder({
      providerId: "coinbase",
      symbol: "BTC-USD",
      side: "sell",
      orderType: "limit",
      quantity: 0.05,
      limitPrice: 68000,
      quoteCurrency: "USD",
      rationale: "Approval-gated concentration trim candidate.",
    });

    expect(result.status).toBe("needs_approval");
    expect(result.liveReady).toBe(false);
    expect(result.decision.finalAction).toBe("live_requires_approval");
    expect(result.decision.approvalRequired).toBe(true);
    expect(result.warnings).toContainEqual(
      expect.objectContaining({ code: "human_approval_required" }),
    );
  });
});

import { TradingProviderConfigSchema } from "@plutus/domain";

import {
  buildTradingProviderPayload,
  createTradingProviderService,
  defaultTradingProviderConfigs,
} from "../providers/trading";

function requireProvider(
  providerId: string,
) {
  const provider = defaultTradingProviderConfigs.find(
    (candidate) => candidate.providerId === providerId,
  );
  if (!provider) throw new Error(`Missing provider fixture ${providerId}`);
  return provider;
}

describe("@plutus/data trading provider registry", () => {
  it("lists Kiwoom plus the current CCXT exchange catalog as dry-run capable providers", () => {
    const service = createTradingProviderService();
    const providerIds = service.listProviders().map((provider) => provider.providerId);

    expect(providerIds[0]).toBe("kiwoom");
    expect(providerIds).toEqual(
      expect.arrayContaining(["upbit", "coinbase", "binance", "kraken", "okx"]),
    );
    expect(providerIds.length).toBeGreaterThanOrEqual(112);
    expect(
      service
        .listProviders()
        .every((provider) => provider.health === "not_configured"),
    ).toBe(true);
    expect(
      service
        .listProviders()
        .every((provider) => provider.permissions.includes("trade_dry_run")),
    ).toBe(true);
  });

  it("maps any supported CCXT exchange to the generic dry-run createOrder payload", () => {
    const payload = buildTradingProviderPayload({
      clientOrderId: "client-kraken",
      intent: {
        providerId: "kraken",
        symbol: "BTC/USDT",
        side: "sell",
        orderType: "limit",
        quantity: 0.2,
        limitPrice: 65000,
        quoteCurrency: "USDT",
      },
    });

    expect(payload).toMatchObject({
      endpoint: "ccxt://kraken/createOrder",
      body: {
        exchange: "kraken",
        symbol: "BTC/USDT",
        side: "sell",
        type: "limit",
        amount: "0.2",
        price: "65000",
        params: {
          clientOrderId: "client-kraken",
          dryRun: true,
        },
      },
    });
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
      endpoint: "ccxt://binance/createOrder",
      mode: "dry_run",
    });
    expect(result.decision.finalAction).toBe("dry_run_allowed");
    expect(result.decision.approvalRequired).toBe(false);
  });

  it("maps every supported provider to its dry-run order payload shape", () => {
    expect(
      buildTradingProviderPayload({
        clientOrderId: "client-kiwoom",
        intent: {
          providerId: "kiwoom",
          symbol: "005930",
          side: "buy",
          orderType: "limit",
          quantity: 3,
          limitPrice: 78000,
          quoteCurrency: "KRW",
        },
      }),
    ).toMatchObject({
      endpoint: "/api/dostk/ordr",
      body: {
        client_order_id: "client-kiwoom",
        symbol: "005930",
        order_type: "limit",
        quantity: "3",
        limit_price: "78000",
      },
    });
    expect(
      buildTradingProviderPayload({
        clientOrderId: "client-binance",
        intent: {
          providerId: "binance",
          symbol: "BTC-USDT",
          side: "buy",
          orderType: "limit",
          quantity: 0.01,
          limitPrice: 65000,
          quoteCurrency: "USDT",
        },
      }),
    ).toMatchObject({
      endpoint: "ccxt://binance/createOrder",
      body: {
        symbol: "BTC/USDT",
        side: "buy",
        type: "limit",
        amount: "0.01",
        price: "65000",
        params: {
          clientOrderId: "client-binance",
          dryRun: true,
        },
      },
    });
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

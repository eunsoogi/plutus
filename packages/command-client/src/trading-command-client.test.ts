import { describe, expect, it } from "vitest";

import {
  createCommandClient,
  createTauriCommandBridge,
  type TradingOrderIntent,
  type TradingProviderConfig,
} from "./index";
import { createMockCommandBridge } from "./fixture-client.test-support";

const provider: TradingProviderConfig = {
  providerId: "binance",
  displayName: "Binance Spot",
  market: "Spot crypto",
  region: "Global",
  environment: "sandbox",
  mode: "dry_run",
  permissions: ["market_data", "trade_dry_run"],
  health: "connected",
  lastCheckedAt: "2026-06-02T00:00:00.000Z",
  credentialRef: null,
  warnings: [],
};

const intent: TradingOrderIntent = {
  providerId: "binance",
  symbol: "BTCUSDT",
  side: "buy",
  orderType: "market",
  quantity: 0.01,
  quoteCurrency: "USDT",
  rationale: "Dry-run before approval.",
};

describe("trading command client", () => {
  it("calls provider and trading commands through validated envelopes", async () => {
    const bridge = createMockCommandBridge({
      "providers.list": async () => [provider],
      "providers.save": async (input) => input,
      "trading.previewDecision": async (input) => ({
        decisionId: "decision-binance-btc",
        finalAction: "dry_run_allowed",
        ...input,
      }),
      "trading.submitDryRunOrder": async (input) => ({
        orderId: "dry-run-binance-btc",
        status: "accepted",
        ...input,
      }),
    });
    const client = createCommandClient(bridge);

    await expect(client.providers.list()).resolves.toHaveLength(1);
    await expect(client.providers.save(provider)).resolves.toMatchObject({
      providerId: "binance",
    });
    await expect(
      client.trading.previewDecision({ provider, intent }),
    ).resolves.toMatchObject({ finalAction: "dry_run_allowed" });
    await expect(
      client.trading.submitDryRunOrder({ provider, intent }),
    ).resolves.toMatchObject({ status: "accepted" });

    expect(bridge.calls.map((call) => call.command)).toEqual([
      "providers.list",
      "providers.save",
      "trading.previewDecision",
      "trading.submitDryRunOrder",
    ]);
  });

  it("maps provider and trading envelopes to Tauri command names", async () => {
    const calls: Array<{ command: string; args?: Record<string, unknown> }> =
      [];
    const bridge = createTauriCommandBridge(
      async <T>(command: string, args?: Record<string, unknown>) => {
        calls.push({ command, args });
        return { ok: true } as T;
      },
    );
    const client = createCommandClient(bridge);

    await client.providers.list({ profileId: "profile-custom" });
    await client.providers.save(provider);
    await client.trading.previewDecision({ provider, intent });
    await client.trading.submitDryRunOrder({ provider, intent });

    expect(calls).toMatchObject([
      { command: "list_trading_providers" },
      {
        command: "save_trading_provider",
        args: { input: { provider_id: "binance", last_checked_at: provider.lastCheckedAt } },
      },
      {
        command: "preview_trading_decision",
        args: { input: { intent: { order_type: "market" } } },
      },
      {
        command: "submit_dry_run_order",
        args: { input: { provider: { provider_id: "binance" } } },
      },
    ]);
  });
});

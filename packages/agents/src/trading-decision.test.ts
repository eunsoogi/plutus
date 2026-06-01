import { describe, expect, it } from "vitest";

import { evaluateTradingDecision } from "./trading-decision";

const now = "2026-06-02T00:00:00.000Z";
const connectedProvider = {
  providerId: "binance" as const,
  displayName: "Binance",
  market: "Spot crypto",
  region: "Global",
  environment: "sandbox" as const,
  mode: "dry_run" as const,
  permissions: ["market_data", "trade_dry_run"] as const,
  health: "connected" as const,
  lastCheckedAt: now,
  credentialRef: null,
  warnings: [],
};
const intent = {
  providerId: "binance" as const,
  symbol: "BTCUSDT",
  side: "buy" as const,
  orderType: "market" as const,
  quantity: 0.01,
  quoteCurrency: "USDT",
  rationale: "Dry-run entry after agent review.",
};

describe("trading decision orchestration", () => {
  it("allows dry-run trading when provider permissions and rationale are present", () => {
    const decision = evaluateTradingDecision({
      provider: connectedProvider,
      intent,
      now,
    });

    expect(decision.finalAction).toBe("dry_run_allowed");
    expect(decision.confidence).toBe("high");
    expect(decision.agentViews.map((view) => view.role)).toEqual([
      "bull_case",
      "bear_case",
      "risk_manager",
      "execution_specialist",
    ]);
  });

  it("blocks disabled providers and missing dry-run permissions", () => {
    const disabled = evaluateTradingDecision({
      provider: { ...connectedProvider, mode: "disabled" },
      intent,
      now,
    });
    expect(disabled.finalAction).toBe("blocked");
    expect(disabled.blockingReasons).toContain("provider_disabled");

    const readOnly = evaluateTradingDecision({
      provider: {
        ...connectedProvider,
        mode: "read_only",
        permissions: ["market_data"],
      },
      intent,
      now,
    });
    expect(readOnly.finalAction).toBe("blocked");
    expect(readOnly.blockingReasons).toContain("dry_run_permission_missing");
  });

  it("requires review for degraded providers and missing rationale", () => {
    const decision = evaluateTradingDecision({
      provider: { ...connectedProvider, health: "degraded" },
      intent: { ...intent, rationale: "" },
      now,
    });

    expect(decision.finalAction).toBe("needs_review");
    expect(decision.blockingReasons).toEqual([
      "provider_degraded",
      "rationale_missing",
    ]);
    expect(decision.approvalRequired).toBe(true);
  });

  it("keeps live requests behind approval even when live permission exists", () => {
    const decision = evaluateTradingDecision({
      provider: {
        ...connectedProvider,
        mode: "live_requires_approval",
        permissions: ["market_data", "trade_dry_run", "trade_live"],
      },
      intent: { ...intent, liveRequested: true },
      now,
    });

    expect(decision.finalAction).toBe("live_requires_approval");
    expect(decision.approvalRequired).toBe(true);
    expect(decision.blockingReasons).toContain("live_requires_user_approval");
  });
});

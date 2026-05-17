import { describe, expect, it } from "vitest";

import {
  ArtifactType,
  AssetType,
  DataFreshnessSchema,
  MemoryKind,
  RecommendationCategory,
  RemoteCommandSchema,
  ResearchRunStatus,
  WikiPageCategory,
  getReportableFreshnessWarnings,
  validateRemoteCommandForSession,
} from "./index";

const uuid = "018f3f5d-89ab-7cde-8123-456789abcdef";

describe("domain enum schemas", () => {
  it("accept the MVP enum values from the domain spec", () => {
    expect(AssetType.parse("stock")).toBe("stock");
    expect(AssetType.parse("etf")).toBe("etf");
    expect(AssetType.parse("crypto")).toBe("crypto");
    expect(AssetType.parse("stablecoin")).toBe("stablecoin");
    expect(AssetType.parse("cash")).toBe("cash");
    expect(ResearchRunStatus.parse("debating")).toBe("debating");
    expect(ArtifactType.parse("audit_export")).toBe("audit_export");
    expect(MemoryKind.parse("wiki_pointer")).toBe("wiki_pointer");
    expect(WikiPageCategory.parse("risk_lesson")).toBe("risk_lesson");
  });

  it("rejects imperative recommendation categories", () => {
    expect(() => RecommendationCategory.parse("buy")).toThrow();
    expect(() => RecommendationCategory.parse("sell")).toThrow();
    expect(() => RecommendationCategory.parse("hold")).toThrow();
  });
});

describe("remote command validation", () => {
  it("accepts the allowed remote command surface", () => {
    expect(RemoteCommandSchema.parse({ type: "portfolio.list" })).toEqual({
      type: "portfolio.list",
    });

    expect(
      RemoteCommandSchema.parse({
        type: "run.start",
        payload: {
          portfolioId: uuid,
          userRequest:
            "BTC and NVDA exposure together looks risky. Review my portfolio and suggest what to inspect.",
          selectedTeam: "portfolio_review",
        },
      }),
    ).toMatchObject({ type: "run.start" });
  });

  it("rejects malformed or unsupported remote commands", () => {
    expect(() =>
      RemoteCommandSchema.parse({
        type: "portfolio.snapshot",
        portfolioId: "not-a-uuid",
      }),
    ).toThrow();
    expect(() =>
      RemoteCommandSchema.parse({ type: "trade.place_order" }),
    ).toThrow();
    expect(() =>
      RemoteCommandSchema.parse({
        type: "watchlist.update_item",
        payload: { id: uuid, targetZone: { lower: 200, upper: 100 } },
      }),
    ).toThrow();
  });

  it("blocks mutations for stale or revoked remote sessions", () => {
    const command = RemoteCommandSchema.parse({
      type: "run.cancel",
      runId: uuid,
    });

    expect(
      validateRemoteCommandForSession(command, {
        sessionStatus: "connected",
        permissions: { allowedCommandGroups: ["run"] },
      }),
    ).toEqual({ allowed: true });

    expect(
      validateRemoteCommandForSession(command, {
        sessionStatus: "stale",
        permissions: { allowedCommandGroups: ["run"] },
      }),
    ).toMatchObject({ allowed: false, reason: "session_not_connected" });

    expect(
      validateRemoteCommandForSession(command, {
        sessionStatus: "revoked",
        permissions: { allowedCommandGroups: ["run"] },
      }),
    ).toMatchObject({ allowed: false, reason: "session_not_connected" });
  });
});

describe("data freshness warnings", () => {
  it("surfaces warning and blocking freshness states", () => {
    const freshness = DataFreshnessSchema.parse({
      provider: "fixture",
      asOf: "2026-05-17T00:00:00.000Z",
      receivedAt: "2026-05-17T00:01:00.000Z",
      delayStatus: "stale",
      warnings: [
        {
          code: "QUOTE_DELAYED",
          severity: "info",
          message: "Quote is delayed.",
        },
        {
          code: "STALE_BTC",
          severity: "warning",
          message: "BTC quote is stale.",
        },
        {
          code: "MISSING_NVDA",
          severity: "blocking",
          message: "NVDA quote is missing.",
        },
      ],
    });

    expect(
      getReportableFreshnessWarnings(freshness).map((warning) => warning.code),
    ).toEqual(["STALE_BTC", "MISSING_NVDA"]);
  });
});

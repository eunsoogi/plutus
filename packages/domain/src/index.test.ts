import { describe, expect, it } from "vitest";
import {
  DataFreshnessSchema,
  RecommendationCategory,
  RemoteCommandSchema,
  makeWarning,
} from "./index";

describe("domain schemas", () => {
  it("rejects recommendation categories outside the MVP allowlist", () => {
    expect(RecommendationCategory.safeParse("place_trade").success).toBe(false);
  });

  it("validates remote command payloads", () => {
    expect(
      RemoteCommandSchema.safeParse({ type: "portfolio.list" }).success,
    ).toBe(true);
    expect(
      RemoteCommandSchema.safeParse({ type: "run.cancel", runId: "not-a-uuid" })
        .success,
    ).toBe(false);
  });

  it("carries freshness warnings with source refs", () => {
    const parsed = DataFreshnessSchema.parse({
      sourceRefId: "quote-nvda",
      asOf: "2026-05-17T00:00:00.000Z",
      delayStatus: "stale",
      warnings: [
        makeWarning(
          "stale_data",
          "warning",
          "Quote is older than freshness policy.",
        ),
      ],
    });
    expect(parsed.warnings[0]?.code).toBe("stale_data");
  });
});

import { describe, expect, it } from "vitest";
import {
  MockCodexRunHost,
  btcNvdaPortfolioReviewScenario,
  codexRunEventSchema,
  finalRunCardSchema,
} from "../index";

describe("CodexRunHost test harness", () => {
  it("streams deterministic BTC/NVDA portfolio review stages and validates the final run card", async () => {
    const host = new MockCodexRunHost(btcNvdaPortfolioReviewScenario());
    const result = await host.run({
      runId: "run-btc-nvda",
      profileId: "profile-core",
      request: "Review my BTC and NVDA portfolio risk.",
      allowedRecommendationCategories: ["risk_warning", "no_action"],
    });

    expect(result.status).toBe("completed");
    expect(
      result.events.map((event) => codexRunEventSchema.parse(event).stage),
    ).toEqual([
      "planning",
      "grounding",
      "executing",
      "debating",
      "validating",
      "reporting",
      "completed",
    ]);
    expect(finalRunCardSchema.parse(result.finalRunCard)).toMatchObject({
      runId: "run-btc-nvda",
      category: "risk_warning",
      riskValidation: "approved_with_warnings",
    });
  });

  it("records structured output validation failure without completing the run", async () => {
    const scenario = btcNvdaPortfolioReviewScenario({
      finalRunCard: { runId: undefined, category: "risk_warning" },
    });
    const host = new MockCodexRunHost(scenario);

    const result = await host.run({
      runId: "run-invalid",
      profileId: "profile-core",
      request: "Review risk.",
      allowedRecommendationCategories: ["risk_warning", "no_action"],
    });

    expect(result.status).toBe("failed");
    expect(result.validationFailures[0]?.path).toContain("runId");
    expect(result.events.at(-1)).toMatchObject({
      stage: "failed",
      type: "validation_failed",
    });
  });

  it("cancels active runs without emitting a final run card", async () => {
    const host = new MockCodexRunHost(btcNvdaPortfolioReviewScenario());
    const result = await host.run({
      runId: "run-cancelled",
      profileId: "profile-core",
      request: "Review BTC and NVDA.",
      allowedRecommendationCategories: ["risk_warning", "no_action"],
      cancelAfterStage: "executing",
    });

    expect(result.status).toBe("cancelled");
    expect(result.finalRunCard).toBeUndefined();
    expect(result.events.at(-1)).toMatchObject({
      stage: "cancelled",
      type: "cancelled",
    });
  });

  it("rejects final categories outside the requested safety envelope", async () => {
    const scenario = btcNvdaPortfolioReviewScenario({
      finalRunCard: { category: "rebalance_candidate" },
    });
    const host = new MockCodexRunHost(scenario);

    const result = await host.run({
      runId: "run-unsafe-category",
      profileId: "profile-core",
      request: "Tell me what to buy.",
      allowedRecommendationCategories: ["risk_warning", "no_action"],
    });

    expect(result.status).toBe("failed");
    expect(result.events.at(-1)).toMatchObject({
      stage: "failed",
      type: "unsafe_final_category",
    });
  });

  it("rejects imperative buy sell hold categories at schema validation", async () => {
    const scenario = btcNvdaPortfolioReviewScenario({
      finalRunCard: { category: "buy" },
    });
    const host = new MockCodexRunHost(scenario);

    const result = await host.run({
      runId: "run-buy-category",
      profileId: "profile-core",
      request: "Tell me what to buy.",
      allowedRecommendationCategories: ["risk_warning", "no_action"],
    });

    expect(result.status).toBe("failed");
    expect(result.validationFailures[0]?.path).toBe("category");
  });
});

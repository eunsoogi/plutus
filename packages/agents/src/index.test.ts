import { describe, expect, it } from "vitest";
import { z } from "zod";
import { fixtureIds } from "@plutus/test-fixtures";
import { RunPlanSchema, assertAllowedFinalCategory } from "./index";
import { MockCodexRunHost } from "./test-harness/local-mock-host";

describe("CodexRunHost mock harness", () => {
  it("streams BTC/NVDA run stages, validates structured output, and records local tools", async () => {
    const host = new MockCodexRunHost();
    const handle = await host.startResearchRun({
      profileId: fixtureIds.profile,
      portfolioId: fixtureIds.corePortfolio,
      userRequest:
        "BTC and NVDA exposure together looks risky. Review my portfolio and suggest what to inspect.",
    });
    const events = [];
    for await (const event of host.streamResearchRun(handle))
      events.push(event);
    expect(events.map((event) => event.stage)).toContain("validating");
    expect(host.router.auditEvents.length).toBeGreaterThan(2);
    const plan = await host.requestStructuredTurn(handle, {
      schema: RunPlanSchema,
      prompt: "plan",
    });
    expect(plan.selectedTeam).toBe("portfolio_review_committee");
    expect(() => assertAllowedFinalCategory("place_trade")).toThrow();
    expect(
      z.object({ category: z.literal("risk_warning") }).parse(
        await host.requestStructuredTurn(handle, {
          schema: z.object({ category: z.literal("risk_warning") }),
          prompt: "final",
        }),
      ).category,
    ).toBe("risk_warning");
  });
});

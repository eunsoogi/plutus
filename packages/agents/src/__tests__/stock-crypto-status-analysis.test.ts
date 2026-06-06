import { describe, expect, it } from "vitest";
import type { z } from "zod";
import { fixtureIds } from "@plutus/test-fixtures";
import { finalRunCardSchema } from "../codex-run-host/schemas";
import { RunPlanSchema } from "../index";
import { MockCodexRunHost } from "../test-harness/local-mock-host";

describe("stock and crypto multi-agent status analysis", () => {
  it("builds a BTC/NVDA run card from specialist local-tool evidence", async () => {
    const previousFixtureFlag = process.env.PLUTUS_ALLOW_FIXTURE_TOOLS;
    process.env.PLUTUS_ALLOW_FIXTURE_TOOLS = "1";
    try {
      const host = new MockCodexRunHost();
      const handle = await host.startResearchRun({
        profileId: fixtureIds.profile,
        portfolioId: fixtureIds.corePortfolio,
        userRequest:
          "BTC and NVDA exposure together looks risky. Review my portfolio and suggest what to inspect.",
      });

      const events = [];
      let finalCardAtCompletion: z.infer<typeof finalRunCardSchema> | undefined;
      for await (const event of host.streamResearchRun(handle)) {
        events.push(event);
        if (event.stage === "completed") {
          finalCardAtCompletion = await host.requestStructuredTurn(handle, {
            schema: finalRunCardSchema,
            prompt: "final run card",
          });
        }
      }
      const finalCard = finalCardAtCompletion;

      expect(events.map((event) => event.stage)).toContain("completed");
      expect(finalCard).toMatchObject({
        selectedTeam: "portfolio_review_committee",
        category: "risk_warning",
        approvalRequired: true,
        freshness: { delayStatus: "delayed" },
      });
      expect(finalCard.summary).toContain("BTC/NVDA correlation is 0.68");
      expect(
        finalCard.warnings.filter((warning) =>
          warning.startsWith("Quote freshness is"),
        ).length,
      ).toBeGreaterThanOrEqual(2);
      expect(finalCard.supportingEvidence).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            label: expect.stringContaining("portfolio_manager exposure"),
            sourceRef: "plutus_portfolio.compute_allocation",
          }),
          expect.objectContaining({
            label: "risk_manager BTC/NVDA correlation 0.68",
            sourceRef: "plutus_risk.compute_correlation",
          }),
          expect.objectContaining({
            label: "market_data_researcher BTC quote freshness",
            sourceRef: "quote:BTC:delayed",
          }),
          expect.objectContaining({
            label: "market_data_researcher NVDA quote freshness",
            sourceRef: "quote:NVDA:delayed",
          }),
        ]),
      );
      expect(finalCard.dissentingViews.join(" ")).toContain("Risk view");
      expect(finalCard.riskChecklist).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            check: "BTC/NVDA correlation",
            status: "warning",
          }),
        ]),
      );
      expect(host.router.auditEvents.map((event) => event.namespace)).toEqual(
        expect.arrayContaining([
          "plutus_market_data",
          "plutus_portfolio",
          "plutus_risk",
          "plutus_reports",
        ]),
      );
    } finally {
      if (previousFixtureFlag === undefined) {
        delete process.env.PLUTUS_ALLOW_FIXTURE_TOOLS;
      } else {
        process.env.PLUTUS_ALLOW_FIXTURE_TOOLS = previousFixtureFlag;
      }
    }
  });

  it("fails closed when fixture-backed portfolio, market, or risk data is unavailable", async () => {
    const previousFixtureFlag = process.env.PLUTUS_ALLOW_FIXTURE_TOOLS;
    delete process.env.PLUTUS_ALLOW_FIXTURE_TOOLS;
    try {
      const host = new MockCodexRunHost();
      const handle = await host.startResearchRun({
        profileId: fixtureIds.profile,
        portfolioId: fixtureIds.corePortfolio,
        userRequest:
          "Review BTC and NVDA exposure, but only if current local data is available.",
      });

      let finalCardAtCompletion: z.infer<typeof finalRunCardSchema> | undefined;
      for await (const event of host.streamResearchRun(handle)) {
        if (event.stage === "completed") {
          finalCardAtCompletion = await host.requestStructuredTurn(handle, {
            schema: finalRunCardSchema,
            prompt: "final run card",
          });
        }
      }

      expect(finalCardAtCompletion).toMatchObject({
        category: "no_action",
        riskValidation: "vetoed",
        confidence: "low",
        freshness: { delayStatus: "unknown" },
      });
      expect(finalCardAtCompletion?.summary).toContain(
        "Required local tool data was unavailable",
      );
      expect(finalCardAtCompletion?.summary).not.toContain("correlation is 0");
      expect(finalCardAtCompletion?.limitations.join(" ")).toContain(
        "deterministic fixtures require PLUTUS_ALLOW_FIXTURE_TOOLS=1",
      );
      expect(finalCardAtCompletion?.supportingEvidence).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            label:
              "market_data_researcher NVDA quote unavailable or incomplete",
            sourceRef: "quote:NVDA",
          }),
        ]),
      );
      expect(finalCardAtCompletion?.riskChecklist).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            check: "Required local tool data",
            status: "fail",
          }),
        ]),
      );
      expect(host.runs.get(handle.runId)?.recommendationCategory).toBe(
        "no_action",
      );
    } finally {
      if (previousFixtureFlag === undefined) {
        delete process.env.PLUTUS_ALLOW_FIXTURE_TOOLS;
      } else {
        process.env.PLUTUS_ALLOW_FIXTURE_TOOLS = previousFixtureFlag;
      }
    }
  });

  it("uses the requested portfolio id for planning and fails closed when that portfolio is unavailable", async () => {
    const previousFixtureFlag = process.env.PLUTUS_ALLOW_FIXTURE_TOOLS;
    process.env.PLUTUS_ALLOW_FIXTURE_TOOLS = "1";
    try {
      const requestedPortfolioId = "018f3f5d-0000-7000-8000-000000009999";
      const host = new MockCodexRunHost();
      const handle = await host.startResearchRun({
        profileId: fixtureIds.profile,
        portfolioId: requestedPortfolioId,
        userRequest:
          "Review BTC and NVDA exposure for this specific portfolio only.",
      });

      const plan = await host.requestStructuredTurn(handle, {
        schema: RunPlanSchema,
        prompt: "plan",
      });
      expect(plan.requiredPortfolioIds).toEqual([requestedPortfolioId]);

      let finalCardAtCompletion: z.infer<typeof finalRunCardSchema> | undefined;
      for await (const event of host.streamResearchRun(handle)) {
        if (event.stage === "completed") {
          finalCardAtCompletion = await host.requestStructuredTurn(handle, {
            schema: finalRunCardSchema,
            prompt: "final run card",
          });
        }
      }

      expect(finalCardAtCompletion).toMatchObject({
        category: "no_action",
        riskValidation: "vetoed",
      });
      expect(finalCardAtCompletion?.warnings.join(" ")).toContain(
        "Portfolio tools cannot access a portfolio outside the active local profile.",
      );
      expect(host.runs.get(handle.runId)?.portfolioId).toBe(
        requestedPortfolioId,
      );
      expect(host.runs.get(handle.runId)?.recommendationCategory).toBe(
        "no_action",
      );
    } finally {
      if (previousFixtureFlag === undefined) {
        delete process.env.PLUTUS_ALLOW_FIXTURE_TOOLS;
      } else {
        process.env.PLUTUS_ALLOW_FIXTURE_TOOLS = previousFixtureFlag;
      }
    }
  });
});

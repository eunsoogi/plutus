import { describe, expect, it } from "vitest";
import { buildInitialResearchRunPrompt } from "../codex-run-host/research-run-prompt";

describe("research run prompt", () => {
  it("instructs Codex to run stock and crypto analysis as a multi-agent team", () => {
    const prompt = buildInitialResearchRunPrompt({
      profileId: "profile-core",
      portfolioId: "portfolio-core",
      selectedTeam: "portfolio_review_committee",
      configHash: "abc123",
      userRequest:
        "BTC and NVDA exposure together looks risky. Review my portfolio.",
      teamAgents: [
        "market_data_researcher",
        "portfolio_manager",
        "risk_manager",
        "report_writer",
      ],
    });

    expect(prompt).toContain(
      "Run this as a Codex multi-agent team using the selected Plutus agents.",
    );
    expect(prompt).toContain(
      "Follow this operating sequence: plan, ground, execute, debate, validate, report.",
    );
    expect(prompt).toContain(
      "Use the local MCP tools for current portfolio, market, risk, and report data instead of asking for pasted inputs.",
    );
    expect(prompt).toContain("exposure, data freshness, correlation");
    expect(prompt).toContain(
      "This is research only. Do not produce live trading instructions or imperative buy, sell, or hold calls.",
    );
  });
});

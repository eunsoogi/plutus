import { describe, expect, it } from "vitest";
import { AGENT_ALLOWLISTS } from "../index";

describe("local tool allowlists", () => {
  it("exports explicit namespace allowlists for all specialist agents", () => {
    expect(Object.keys(AGENT_ALLOWLISTS).sort()).toEqual([
      "crypto_analyst",
      "equity_analyst",
      "llm_wiki_curator",
      "market_data_researcher",
      "orchestrator",
      "portfolio_manager",
      "quant_strategy_researcher",
      "report_writer",
      "risk_manager",
      "technical_analyst",
    ]);
    expect(AGENT_ALLOWLISTS.llm_wiki_curator.allowedNamespaces).toContain(
      "plutus_wiki",
    );
  });
});

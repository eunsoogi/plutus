import { describe, expect, it } from "vitest";
import { LocalToolRouter, createInMemoryToolRuntime } from "../index";

const baseContext = {
  runId: "run-btc-nvda",
  profileId: "profile-core",
  agentName: "quant_strategy_researcher",
  selectedTeam: "quant_strategy_desk",
  allowedNamespaces: [
    "plutus_market_data",
    "plutus_backtest",
    "plutus_risk",
    "plutus_audit",
  ],
  allowedTools: [
    "plutus_backtest.run_backtest",
    "plutus_audit.get_run_audit_trail",
  ],
  writeScopes: ["plutus_backtest.run_backtest"],
};

describe("LocalToolRouter", () => {
  it("does not accept generic status stubs for portfolio, memory, wiki, or report artifacts", async () => {
    const runtime = createInMemoryToolRuntime();
    const router = new LocalToolRouter(runtime);

    const portfolio = await router.call(
      {
        ...baseContext,
        agentName: "portfolio_manager",
        selectedTeam: "portfolio_review_committee",
        allowedNamespaces: ["plutus_portfolio"],
        allowedTools: ["plutus_portfolio.compute_allocation"],
        writeScopes: [],
      },
      {
        namespace: "plutus_portfolio",
        tool: "compute_allocation",
        input: {},
      },
    );
    expect(portfolio.data).not.toMatchObject({
      tool: "compute_allocation",
      status: "ok",
    });

    const wikiContext = {
      ...baseContext,
      agentName: "llm_wiki_curator",
      selectedTeam: "knowledge_curation",
      allowedNamespaces: ["plutus_memory", "plutus_wiki"],
      allowedTools: [
        "plutus_memory.capture_research_memory",
        "plutus_wiki.create_wiki_page",
      ],
      writeScopes: [
        "plutus_memory.capture_research_memory",
        "plutus_wiki.create_wiki_page",
      ],
    };
    const memory = await router.call(wikiContext, {
      namespace: "plutus_memory",
      tool: "capture_research_memory",
      input: {
        summary: "NVDA valuation memory.",
        semanticText: "NVDA valuation memory.",
        tags: ["nvda"],
        sourceRefs: [{ type: "run", id: "run-btc-nvda" }],
      },
    });
    expect(memory.data).not.toMatchObject({
      tool: "capture_research_memory",
      status: "ok",
    });

    const wiki = await router.call(wikiContext, {
      namespace: "plutus_wiki",
      tool: "create_wiki_page",
      input: {
        category: "instrument",
        title: "NVDA",
        slug: "nvda",
        markdown: "NVDA source linked. [source:run-btc-nvda]",
        summary: "NVDA page.",
        tags: ["nvda"],
        sourceRefs: [{ type: "run", id: "run-btc-nvda" }],
        revisionNote: "Create page.",
      },
    });
    expect(wiki.data).not.toMatchObject({
      tool: "create_wiki_page",
      status: "ok",
    });

    const report = await router.call(
      {
        ...baseContext,
        agentName: "report_writer",
        selectedTeam: "portfolio_review_committee",
        allowedNamespaces: ["plutus_reports"],
        allowedTools: ["plutus_reports.render_report"],
        writeScopes: ["plutus_reports.render_report"],
      },
      {
        namespace: "plutus_reports",
        tool: "render_report",
        input: {
          sections: [{ title: "Summary", body: "Report body." }],
          sourceRefs: [{ id: "run-btc-nvda", provider: "fixture" }],
        },
      },
    );
    expect(report.data).not.toMatchObject({
      tool: "render_report",
      status: "stored",
    });
    expect(
      (report.data as { artifact: { contentHash?: string } }).artifact
        .contentHash,
    ).toMatch(/^sha256:/);
  });
});

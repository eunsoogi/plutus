import { z } from "zod";
import { type ResearchRun } from "@plutus/domain";
import { LocalToolRouter } from "@plutus/local-tools";
import { makeRunContext } from "../../../local-tools/src/test-support";
import { type CodexRunEvent, type CodexRunHost } from "../index";
import { MockCodexRunHost as ScenarioCodexRunHost } from "./mock-codex-sdk";
import type { ScriptedRunScenario } from "./scripted-run-stream";
import {
  createAnalysisRunCard,
  stockCryptoAnalysisPlan,
} from "./stock-crypto-analysis";
import type { ResearchRunHandle } from "../codex-run-host/codex-run-host";
import type { FinalRunCard } from "../codex-run-host/schemas";

const ids = {
  profile: "018f3f5d-0000-7000-8000-000000000001",
  portfolio: "018f3f5d-0000-7000-8000-000000000002",
  run: "018f3f5d-0000-7000-8000-000000000006",
};

const btcNvdaRun = {
  id: ids.run,
  profileId: ids.profile,
  portfolioId: ids.portfolio,
  userRequest: "Review BTC and NVDA portfolio risk.",
  status: "queued",
} as ResearchRun;

export class MockCodexRunHost implements CodexRunHost {
  readonly router = new LocalToolRouter();
  readonly events: CodexRunEvent[] = [];
  readonly runs = new Map<string, ResearchRun>();
  readonly finalRunCards = new Map<string, FinalRunCard>();
  private readonly scenarioHost?: ScenarioCodexRunHost;

  constructor(scenario?: ScriptedRunScenario) {
    this.scenarioHost = scenario
      ? new ScenarioCodexRunHost(scenario)
      : undefined;
  }

  async run(
    request: import("../codex-run-host/codex-run-host").CodexRunRequest,
  ) {
    if (!this.scenarioHost) {
      throw new Error("Scenario run API requires a scripted run scenario.");
    }
    return this.scenarioHost.run(request);
  }

  async startResearchRun(input: {
    profileId: string;
    portfolioId?: string;
    userRequest: string;
  }): Promise<ResearchRunHandle> {
    const run: ResearchRun = {
      ...btcNvdaRun,
      profileId: input.profileId,
      portfolioId: input.portfolioId ?? ids.portfolio,
      userRequest: input.userRequest,
      status: "queued",
    };
    this.runs.set(run.id, run);
    return {
      runId: run.id,
      threadId: "mock-thread-btc-nvda",
      configHash: "mock-config-hash",
    };
  }

  async *streamResearchRun(
    handle: ResearchRunHandle,
  ): AsyncIterable<CodexRunEvent> {
    const stages: Array<ResearchRun["status"]> = [
      "planning",
      "grounding",
      "executing",
      "debating",
      "validating",
      "reporting",
      "completed",
    ];
    for (const stage of stages) {
      if (stage === "completed") {
        await this.finalizeRun(handle);
      }
      const event: CodexRunEvent = {
        type: stage === "completed" ? "run.completed" : "run.stage_started",
        runId: handle.runId,
        stage,
        message: `stage ${stage}`,
      };
      this.events.push(event);
      yield event;
    }
  }

  private async finalizeRun(handle: ResearchRunHandle): Promise<void> {
    const run = this.runs.get(handle.runId);
    if (run) {
      const portfolioId = run.portfolioId ?? ids.portfolio;
      run.status = "completed";
      const allocation = await this.router.call(
        makeRunContext("portfolio_manager"),
        {
          namespace: "plutus_portfolio",
          tool: "compute_allocation",
          input: { portfolioId },
        },
      );
      const btcQuote = await this.router.call(
        makeRunContext("market_data_researcher"),
        {
          namespace: "plutus_market_data",
          tool: "get_quote",
          input: { symbol: "BTC" },
        },
      );
      const nvdaQuote = await this.router.call(
        makeRunContext("market_data_researcher"),
        {
          namespace: "plutus_market_data",
          tool: "get_quote",
          input: { symbol: "NVDA" },
        },
      );
      const concentration = await this.router.call(
        makeRunContext("risk_manager"),
        {
          namespace: "plutus_risk",
          tool: "check_concentration",
          input: { portfolioId },
        },
      );
      const correlation = await this.router.call(
        makeRunContext("risk_manager"),
        {
          namespace: "plutus_risk",
          tool: "compute_correlation",
          input: { instrumentIds: ["BTC", "NVDA"] },
        },
      );
      const liquidity = await this.router.call(makeRunContext("risk_manager"), {
        namespace: "plutus_risk",
        tool: "check_liquidity",
        input: {
          instrumentIds: ["BTC", "NVDA"],
          orderSizeAssumptions: { BTC: 1_000_000, NVDA: 5_000_000 },
        },
      });
      const finalRunCard = createAnalysisRunCard({
        runId: handle.runId,
        profileId: run.profileId,
        userRequest: run.userRequest,
        allocation,
        btcQuote,
        nvdaQuote,
        concentration,
        correlation,
        liquidity,
      });
      run.recommendationCategory = finalRunCard.category;
      this.finalRunCards.set(handle.runId, finalRunCard);
      await this.router.call(makeRunContext("report_writer"), {
        namespace: "plutus_reports",
        tool: "create_run_card",
        input: {
          runId: handle.runId,
          payload: {
            category: finalRunCard.category,
            title: finalRunCard.title,
            summary: finalRunCard.summary,
            findings: finalRunCard.supportingEvidence.map(
              (item) => `${item.label}: ${item.sourceRef}`,
            ),
            sourceRefs: finalRunCard.supportingEvidence.map((item) => ({
              id: item.sourceRef,
              provider: "plutus_multi_agent_fixture",
              title: item.label,
              retrievedAt: new Date(0).toISOString(),
            })),
          },
        },
      });
      await this.router.call(makeRunContext("llm_wiki_curator"), {
        namespace: "plutus_memory",
        tool: "capture_research_memory",
        input: { memory: "BTC and NVDA concentration needs periodic review." },
      });
      await this.router.call(makeRunContext("llm_wiki_curator"), {
        namespace: "plutus_wiki",
        tool: "create_wiki_page",
        input: {
          title: "BTC/NVDA concentration lesson",
          body: "Review combined BTC and NVDA exposure before rebalance.",
        },
      });
    }
  }

  async resumeResearchRun(threadId: string): Promise<ResearchRunHandle> {
    return { runId: ids.run, threadId, configHash: "mock-config-hash" };
  }

  async requestStructuredTurn<T>(
    handle: ResearchRunHandle,
    request: { schema: z.ZodType<T>; prompt: string },
  ): Promise<T> {
    const run = this.runs.get(handle.runId);
    const candidate = request.prompt.includes("plan")
      ? stockCryptoAnalysisPlan(run?.portfolioId ?? ids.portfolio)
      : (this.finalRunCards.get(handle.runId) ?? { category: "risk_warning" });
    return request.schema.parse(candidate);
  }

  async cancelResearchRun(handle: ResearchRunHandle): Promise<void> {
    const run = this.runs.get(handle.runId);
    if (run) run.status = "cancelled";
  }

  async archiveResearchRun(_handle: ResearchRunHandle): Promise<void> {}
}

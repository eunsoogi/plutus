import { z } from "zod";
import {
  RecommendationCategory,
  ResearchRunStatus,
  type ResearchRun,
} from "@plutus/domain";
import { LocalToolRouter, makeRunContext } from "@plutus/local-tools";
import { MockCodexRunHost as ScenarioCodexRunHost } from "./test-harness/mock-codex-sdk";
import type { ScriptedRunScenario } from "./test-harness/scripted-run-stream";
import type { ResearchRunHandle } from "./codex-run-host/codex-run-host";
export { btcNvdaPortfolioReviewScenario } from "./test-harness/btc-nvda-scenario";
export { validateStructuredTurn } from "./test-harness/mock-structured-turn";
export { CodexSdkRunHost } from "./codex-run-host/codex-sdk-run-host";
export {
  codexRunEventSchema,
  finalRecommendationCategorySchema,
  finalRunCardSchema,
  runStageSchema,
} from "./codex-run-host/schemas";
export type {
  CodexRunEvent as ScenarioCodexRunEvent,
  FinalRunCard,
  RunStage,
} from "./codex-run-host/schemas";
export type {
  CodexRunRequest,
  CodexRunResult,
  ProductCodexRunHost,
  ResearchRunHandle,
  ValidationFailure,
} from "./codex-run-host/codex-run-host";

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

export const RunPlanSchema = z.object({
  intent: z.enum([
    "portfolio_review",
    "equity_research",
    "crypto_research",
    "strategy_backtest",
    "technical_analysis",
    "watchlist_review",
    "knowledge_curation",
  ]),
  selectedTeam: z.enum([
    "portfolio_review_committee",
    "investment_committee",
    "crypto_research_desk",
    "quant_strategy_desk",
    "technical_analysis_panel",
    "knowledge_curation_desk",
  ]),
  requiredInstruments: z.array(z.string()),
  requiredPortfolioIds: z.array(z.string().uuid()),
  requiredTools: z.array(z.string()),
  validationLevel: z.enum(["standard", "enhanced_risk", "blocking_risk"]),
  rationale: z.string(),
});

export const CodexRunEventSchema = z.object({
  type: z.enum([
    "run.status_changed",
    "run.stage_started",
    "run.stage_completed",
    "agent.message",
    "tool.call_started",
    "tool.call_completed",
    "warning.registered",
    "artifact.created",
    "run.completed",
    "run.failed",
  ]),
  runId: z.string().uuid(),
  stage: ResearchRunStatus.optional(),
  message: z.string().optional(),
});
export type CodexRunEvent = z.infer<typeof CodexRunEventSchema>;

export interface CodexRunHost {
  startResearchRun(input: {
    profileId: string;
    portfolioId?: string;
    userRequest: string;
  }): Promise<ResearchRunHandle>;
  streamResearchRun(handle: ResearchRunHandle): AsyncIterable<CodexRunEvent>;
  resumeResearchRun(threadId: string): Promise<ResearchRunHandle>;
  requestStructuredTurn<T>(
    handle: ResearchRunHandle,
    request: { schema: z.ZodType<T>; prompt: string },
  ): Promise<T>;
  cancelResearchRun(handle: ResearchRunHandle): Promise<void>;
  archiveResearchRun(handle: ResearchRunHandle): Promise<void>;
}

export class MockCodexRunHost implements CodexRunHost {
  readonly router = new LocalToolRouter();
  readonly events: CodexRunEvent[] = [];
  readonly runs = new Map<string, ResearchRun>();
  private readonly scenarioHost?: ScenarioCodexRunHost;

  constructor(scenario?: ScriptedRunScenario) {
    this.scenarioHost = scenario
      ? new ScenarioCodexRunHost(scenario)
      : undefined;
  }

  async run(
    request: import("./codex-run-host/codex-run-host").CodexRunRequest,
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
      const event: CodexRunEvent = {
        type: stage === "completed" ? "run.completed" : "run.stage_started",
        runId: handle.runId,
        stage,
        message: `stage ${stage}`,
      };
      this.events.push(event);
      yield event;
    }
    const run = this.runs.get(handle.runId);
    if (run) {
      run.status = "completed";
      run.recommendationCategory = "risk_warning";
      await this.router.call(makeRunContext("portfolio_manager"), {
        namespace: "plutus_portfolio",
        tool: "compute_allocation",
        input: { portfolioId: ids.portfolio },
      });
      await this.router.call(makeRunContext("risk_manager"), {
        namespace: "plutus_risk",
        tool: "check_concentration",
        input: { portfolioId: ids.portfolio },
      });
      await this.router.call(makeRunContext("report_writer"), {
        namespace: "plutus_reports",
        tool: "create_run_card",
        input: { runId: handle.runId },
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
    _handle: ResearchRunHandle,
    request: { schema: z.ZodType<T>; prompt: string },
  ): Promise<T> {
    const candidate = request.prompt.includes("plan")
      ? {
          intent: "portfolio_review",
          selectedTeam: "portfolio_review_committee",
          requiredInstruments: ["BTC", "NVDA"],
          requiredPortfolioIds: [ids.portfolio],
          requiredTools: [
            "plutus_portfolio.compute_allocation",
            "plutus_risk.check_concentration",
          ],
          validationLevel: "enhanced_risk",
          rationale: "The request references current holdings and risk.",
        }
      : { category: "risk_warning" };
    return request.schema.parse(candidate);
  }

  async cancelResearchRun(handle: ResearchRunHandle): Promise<void> {
    const run = this.runs.get(handle.runId);
    if (run) run.status = "cancelled";
  }

  async archiveResearchRun(_handle: ResearchRunHandle): Promise<void> {}
}

export function assertAllowedFinalCategory(category: unknown) {
  return RecommendationCategory.parse(category);
}

export const runCardArtifact = {
  id: "018f3f5d-0000-7000-8000-000000000007",
  runId: ids.run,
  artifactType: "run_card",
  title: "BTC/NVDA portfolio review",
};

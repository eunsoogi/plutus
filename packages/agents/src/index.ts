import { z } from "zod";
import { RecommendationCategory, ResearchRunStatus } from "@plutus/domain";
import type { ResearchRunHandle } from "./codex-run-host/codex-run-host";
export { CodexSdkRunHost } from "./codex-run-host/codex-sdk-run-host";
export {
  codexRunEventSchema,
  finalRecommendationCategorySchema,
  finalRunCardSchema,
  modelFinalRunCardSchema,
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

export function assertAllowedFinalCategory(category: unknown) {
  return RecommendationCategory.parse(category);
}

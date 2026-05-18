import type { CodexRunEvent, FinalRunCard, RunStage } from "./schemas";
import type { z } from "zod";

export interface CodexRunRequest {
  runId: string;
  profileId: string;
  request: string;
  allowedRecommendationCategories: string[];
  cancelAfterStage?: RunStage;
}

export interface ValidationFailure {
  path: string;
  message: string;
}

export interface CodexRunResult {
  status: "completed" | "failed" | "cancelled";
  events: CodexRunEvent[];
  finalRunCard?: FinalRunCard;
  validationFailures: ValidationFailure[];
}

export interface CodexRunHost {
  run(request: CodexRunRequest): Promise<CodexRunResult>;
}

export interface ResearchRunHandle {
  runId: string;
  threadId: string;
  configHash: string;
}

export interface StartResearchRunInput {
  runId?: string;
  profileId: string;
  portfolioId?: string;
  selectedTeam?: string;
  userRequest: string;
  appDataPath?: string;
}

export interface ResumeResearchRunOptions {
  expectedConfigHash?: string;
  profileId?: string;
  runId?: string;
}

export interface StructuredTurnRequest<T> {
  schema: z.ZodType<T>;
  prompt: string;
}

export interface ProductCodexRunHost {
  startResearchRun(input: StartResearchRunInput): Promise<ResearchRunHandle>;
  streamResearchRun(handle: ResearchRunHandle): AsyncIterable<CodexRunEvent>;
  resumeResearchRun(
    threadId: string,
    options?: ResumeResearchRunOptions,
  ): Promise<ResearchRunHandle>;
  requestStructuredTurn<T>(
    handle: ResearchRunHandle,
    request: StructuredTurnRequest<T>,
  ): Promise<T>;
  cancelResearchRun(handle: ResearchRunHandle): Promise<void>;
  archiveResearchRun(handle: ResearchRunHandle): Promise<void>;
}

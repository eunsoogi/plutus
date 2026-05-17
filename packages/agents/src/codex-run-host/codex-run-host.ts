import type { CodexRunEvent, FinalRunCard, RunStage } from "./schemas";

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

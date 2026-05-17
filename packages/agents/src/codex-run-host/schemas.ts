import { z } from "zod";

export const runStageSchema = z.enum([
  "planning",
  "grounding",
  "executing",
  "debating",
  "validating",
  "reporting",
  "completed",
  "failed",
  "cancelled",
]);

export const codexRunEventSchema = z.object({
  runId: z.string(),
  stage: runStageSchema,
  type: z.string(),
  message: z.string(),
  at: z.string().datetime(),
  payload: z.unknown().optional(),
});

export const finalRecommendationCategorySchema = z.enum([
  "observe",
  "research_more",
  "rebalance_candidate",
  "strategy_candidate",
  "risk_warning",
  "no_action",
]);

export const finalRunCardSchema = z.object({
  runId: z.string(),
  profileId: z.string(),
  title: z.string(),
  category: finalRecommendationCategorySchema,
  riskValidation: z.enum(["approved", "approved_with_warnings", "vetoed"]),
  summary: z.string(),
  warnings: z.array(z.string()),
  evidenceRefs: z.array(z.string()),
  assumptions: z.array(z.string()).default([]),
  dissentingViews: z.array(z.string()).default([]),
  artifactRefs: z.array(z.string()).default([]),
  approvalRequired: z.boolean().default(true),
});

export type CodexRunEvent = z.infer<typeof codexRunEventSchema>;
export type FinalRunCard = z.infer<typeof finalRunCardSchema>;
export type RunStage = z.infer<typeof runStageSchema>;

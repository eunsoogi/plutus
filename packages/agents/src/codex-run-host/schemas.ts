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
  userRequest: z.string(),
  selectedTeam: z.string(),
  category: finalRecommendationCategorySchema,
  riskValidation: z.enum(["approved", "approved_with_warnings", "vetoed"]),
  summary: z.string(),
  confidence: z.enum(["low", "medium", "high"]),
  warnings: z.array(z.string()),
  evidenceRefs: z.array(z.string()),
  supportingEvidence: z.array(
    z.object({
      label: z.string(),
      sourceRef: z.string(),
      freshness: z.unknown().optional(),
    }),
  ),
  freshness: z
    .object({
      delayStatus: z
        .enum(["realtime", "delayed", "stale", "unknown"])
        .default("unknown"),
    })
    .passthrough()
    .default({ delayStatus: "unknown" }),
  caveats: z.array(z.string()).default([]),
  assumptions: z.array(z.string()).default([]),
  dissentingViews: z.array(z.string()).default([]),
  riskChecklist: z.array(
    z.object({
      check: z.string(),
      status: z.enum(["pass", "warning", "fail", "not_applicable"]),
      evidenceRefs: z.array(z.string()),
    }),
  ),
  artifacts: z.array(
    z.object({
      artifactId: z.string(),
      type: z.string(),
      title: z.string(),
      path: z.string().optional(),
    }),
  ),
  artifactRefs: z.array(z.string()).default([]),
  limitations: z.array(z.string()),
  nextActions: z.array(z.string()),
  approvalRequired: z.boolean().default(true),
});

export const modelFinalRunCardSchema = finalRunCardSchema.omit({
  runId: true,
  profileId: true,
});

export type CodexRunEvent = z.infer<typeof codexRunEventSchema>;
export type FinalRunCard = z.infer<typeof finalRunCardSchema>;
export type RunStage = z.infer<typeof runStageSchema>;

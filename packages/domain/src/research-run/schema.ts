import { z } from "zod";

import {
  Confidence,
  DataFreshnessSchema,
  RecommendationCategory,
  ResearchRunStatus,
} from "../common";
import { IsoUtcDateTimeSchema, UuidSchema } from "../ids";

export const StartResearchRunInputSchema = z.object({
  portfolioId: UuidSchema,
  userRequest: z.string().min(1),
  selectedTeam: z.string().min(1).optional(),
});

export const ResearchRunSchema = z.object({
  id: UuidSchema,
  profileId: UuidSchema,
  portfolioId: UuidSchema,
  status: ResearchRunStatus,
  userRequest: z.string().min(1),
  selectedTeam: z.string().min(1),
  codexThreadId: z.string().nullable(),
  workspacePath: z.string().min(1),
  customAgentVersions: z.record(z.string(), z.string()),
  localToolConfigHash: z.string().min(1),
  modelConfig: z.record(z.string(), z.unknown()),
  recommendationCategory: RecommendationCategory.nullable(),
  confidence: Confidence.nullable(),
  startedAt: IsoUtcDateTimeSchema,
  completedAt: IsoUtcDateTimeSchema.nullable(),
  failureReason: z.string().nullable(),
});

export const SpecialistFindingSchema = z.object({
  role: z.string().min(1),
  scope: z.string().min(1),
  inputsUsed: z.array(z.string().min(1)),
  keyObservations: z.array(z.string().min(1)),
  confidence: Confidence,
  dataFreshness: z.array(DataFreshnessSchema),
  limitations: z.array(z.string()),
  recommendedNextAction: z.string().min(1),
  evidenceRefs: z.array(z.string().min(1)),
});

export type ResearchRun = z.infer<typeof ResearchRunSchema>;
export type StartResearchRunInput = z.infer<typeof StartResearchRunInputSchema>;
export type SpecialistFinding = z.infer<typeof SpecialistFindingSchema>;

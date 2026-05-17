import { z } from "zod";

import {
  ArtifactType,
  DataFreshnessSchema,
  RecommendationCategory,
  Confidence,
} from "../common";
import { IsoUtcDateTimeSchema, UuidSchema } from "../ids";

export const AgentArtifactSchema = z.object({
  id: UuidSchema,
  researchRunId: UuidSchema,
  artifactType: ArtifactType,
  title: z.string().min(1),
  storageKey: z.string().min(1),
  contentHash: z.string().min(1),
  mimeType: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()),
  createdByAgent: z.string().min(1),
  createdAt: IsoUtcDateTimeSchema,
});

export const RunCardSchema = z.object({
  runId: UuidSchema,
  userRequest: z.string().min(1),
  selectedTeam: z.string().min(1),
  recommendationCategory: RecommendationCategory,
  plainLanguageSummary: z.string().min(1),
  confidence: Confidence,
  supportingEvidence: z.array(
    z.object({
      label: z.string().min(1),
      sourceRef: z.string().min(1),
      freshness: DataFreshnessSchema.optional(),
    }),
  ),
  dissentingViews: z.array(z.string()),
  riskChecklist: z.array(
    z.object({
      check: z.string().min(1),
      status: z.enum(["pass", "warning", "fail", "not_applicable"]),
      evidenceRefs: z.array(z.string().min(1)),
    }),
  ),
  artifacts: z.array(
    z.object({
      artifactId: UuidSchema,
      type: ArtifactType,
      title: z.string().min(1),
    }),
  ),
  limitations: z.array(z.string()),
  nextActions: z.array(z.string()),
});

export type AgentArtifact = z.infer<typeof AgentArtifactSchema>;
export type RunCard = z.infer<typeof RunCardSchema>;

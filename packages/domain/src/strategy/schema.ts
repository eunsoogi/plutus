import { z } from "zod";

import { IsoUtcDateTimeSchema, UuidSchema } from "../ids";

export const StrategyStatus = z.enum([
  "draft",
  "validated",
  "rejected",
  "archived",
]);
export const BacktestStatus = z.enum([
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
]);

export const StrategySpecSchema = z.object({
  id: UuidSchema,
  profileId: UuidSchema,
  researchRunId: UuidSchema.nullable(),
  name: z.string().min(1),
  assetUniverse: z.array(UuidSchema),
  timeRange: z.object({
    start: IsoUtcDateTimeSchema,
    end: IsoUtcDateTimeSchema,
  }),
  entryRules: z.array(z.string().min(1)),
  exitRules: z.array(z.string().min(1)),
  positionSizing: z.record(z.string(), z.unknown()),
  riskRules: z.array(z.string().min(1)),
  requiredData: z.array(z.string().min(1)),
  benchmarkId: UuidSchema.nullable(),
  feeAssumptionBps: z.number().nonnegative(),
  slippageAssumptionBps: z.number().nonnegative(),
  engineTarget: z.string().min(1),
  validationPlan: z.array(z.string().min(1)),
  status: StrategyStatus,
});

export const BacktestRunSchema = z.object({
  id: UuidSchema,
  strategySpecId: UuidSchema,
  researchRunId: UuidSchema.nullable(),
  status: BacktestStatus,
  datasetRef: z.string().min(1),
  assumptions: z.record(z.string(), z.unknown()),
  metrics: z.record(z.string(), z.number()),
  warnings: z.array(z.string()),
  artifactIds: z.array(UuidSchema),
  startedAt: IsoUtcDateTimeSchema,
  completedAt: IsoUtcDateTimeSchema.nullable(),
  failureReason: z.string().nullable(),
});

export type StrategySpec = z.infer<typeof StrategySpecSchema>;
export type BacktestRun = z.infer<typeof BacktestRunSchema>;

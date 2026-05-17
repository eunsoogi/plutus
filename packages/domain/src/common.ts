import { z } from "zod";

import { IsoUtcDateTimeSchema, UuidSchema } from "./ids";

export const AssetType = z.enum([
  "stock",
  "etf",
  "crypto",
  "stablecoin",
  "cash",
]);

export const RecommendationCategory = z.enum([
  "observe",
  "research_more",
  "rebalance_candidate",
  "strategy_candidate",
  "risk_warning",
  "no_action",
]);

export const ResearchRunStatus = z.enum([
  "queued",
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

export const ArtifactType = z.enum([
  "run_card",
  "report_markdown",
  "report_html",
  "chart_json",
  "strategy_spec",
  "backtest_result",
  "mobile_summary",
  "audit_export",
]);

export const MemoryKind = z.enum([
  "user_preference",
  "research_memory",
  "strategy_memory",
  "workflow_memory",
  "wiki_source_memory",
  "wiki_pointer",
]);

export const WikiPageCategory = z.enum([
  "thesis",
  "strategy",
  "risk_lesson",
  "instrument",
  "workflow",
  "glossary",
]);

export const DelayStatus = z.enum(["realtime", "delayed", "stale", "unknown"]);
export const WarningSeverity = z.enum(["info", "warning", "blocking"]);
export const Confidence = z.enum(["low", "medium", "high"]);

export const WarningSchema = z.object({
  code: z.string().min(1),
  severity: WarningSeverity,
  message: z.string().min(1),
});

export const DataFreshnessSchema = z.object({
  provider: z.string().min(1).default("unknown"),
  sourceRefId: z.string().min(1).optional(),
  asOf: IsoUtcDateTimeSchema,
  receivedAt: IsoUtcDateTimeSchema.default("1970-01-01T00:00:00.000Z"),
  delayStatus: DelayStatus,
  warnings: z.array(WarningSchema),
});

export const TimestampedSchema = z.object({
  createdAt: IsoUtcDateTimeSchema,
  updatedAt: IsoUtcDateTimeSchema,
});

export const StorageRefSchema = z.object({
  id: UuidSchema,
  storageKey: z.string().min(1),
  contentHash: z.string().min(1),
});

export function getReportableFreshnessWarnings(
  freshness: z.infer<typeof DataFreshnessSchema>,
): Array<z.infer<typeof WarningSchema>> {
  return freshness.warnings.filter((warning) => warning.severity !== "info");
}

export function makeWarning(
  code: string,
  severity: z.infer<typeof WarningSeverity>,
  message: string,
): z.infer<typeof WarningSchema> {
  return WarningSchema.parse({ code, severity, message });
}

export type AssetType = z.infer<typeof AssetType>;
export type RecommendationCategory = z.infer<typeof RecommendationCategory>;
export type ResearchRunStatus = z.infer<typeof ResearchRunStatus>;
export type ArtifactType = z.infer<typeof ArtifactType>;
export type MemoryKind = z.infer<typeof MemoryKind>;
export type WikiPageCategory = z.infer<typeof WikiPageCategory>;
export type DataFreshness = z.infer<typeof DataFreshnessSchema>;
export type Warning = z.infer<typeof WarningSchema>;

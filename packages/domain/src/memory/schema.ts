import { z } from "zod";

import { MemoryKind } from "../common";
import { IsoUtcDateTimeSchema, UuidSchema } from "../ids";

export const MemoryStatus = z.enum(["active", "archived", "deleted"]);
export const MemoryActivityEventType = z.enum([
  "captured",
  "recalled",
  "updated",
  "pinned",
  "archived",
  "deleted",
  "category_disabled",
  "category_enabled",
]);

export const MemoryRecordSchema = z.object({
  id: UuidSchema,
  profileId: UuidSchema,
  mem0Id: z.string().min(1),
  kind: MemoryKind,
  summary: z.string().min(1),
  tags: z.array(z.string().min(1)),
  sourceRefs: z.array(z.string().min(1)),
  capturePolicy: z.string().min(1),
  sensitivityClass: z.string().min(1),
  retentionClass: z.string().min(1),
  status: MemoryStatus,
  lastRecalledAt: IsoUtcDateTimeSchema.nullable(),
  createdAt: IsoUtcDateTimeSchema,
  updatedAt: IsoUtcDateTimeSchema,
  deletedAt: IsoUtcDateTimeSchema.nullable(),
});

export const MemoryActivitySchema = z.object({
  id: UuidSchema,
  memoryId: UuidSchema,
  eventType: MemoryActivityEventType,
  actor: z.string().min(1),
  researchRunId: UuidSchema.nullable(),
  auditRef: z.string().nullable(),
  payload: z.record(z.string(), z.unknown()),
  createdAt: IsoUtcDateTimeSchema,
});

export type MemoryRecord = z.infer<typeof MemoryRecordSchema>;
export type MemoryActivity = z.infer<typeof MemoryActivitySchema>;

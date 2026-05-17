import { z } from "zod";

export const sourceRefSchema = z.object({
  id: z.string(),
  provider: z.string(),
  title: z.string().optional(),
  url: z.string().url().optional(),
  asOf: z.string().datetime().optional(),
  retrievedAt: z.string().datetime(),
});

export const localToolWarningSchema = z.object({
  code: z.string(),
  severity: z.enum(["info", "warning", "blocking"]),
  message: z.string(),
  evidenceRefs: z.array(z.string()).default([]),
});

export const localToolResponseSchema = z.object({
  ok: z.boolean(),
  data: z.unknown().optional(),
  sourceRefs: z.array(sourceRefSchema),
  warnings: z.array(localToolWarningSchema),
  auditRef: z.string(),
});

export type LocalToolResponse = z.infer<typeof localToolResponseSchema>;
export type LocalToolWarning = z.infer<typeof localToolWarningSchema>;
export type SourceRef = z.infer<typeof sourceRefSchema>;

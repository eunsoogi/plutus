import { z } from "zod";

import { Confidence, WikiPageCategory } from "../common";
import { IsoUtcDateTimeSchema, UuidSchema } from "../ids";

export const WikiFreshness = z.enum([
  "current",
  "needs_review",
  "stale",
  "contradicted",
]);
export const WikiStatus = z.enum(["active", "archived"]);
export const WikiLinkType = z.enum([
  "supports",
  "contradicts",
  "updates",
  "related",
  "supersedes",
]);

export const WikiPageSchema = z.object({
  id: UuidSchema,
  profileId: UuidSchema,
  slug: z.string().min(1),
  category: WikiPageCategory,
  title: z.string().min(1),
  summary: z.string().min(1),
  status: WikiStatus,
  currentRevisionId: UuidSchema.nullable(),
  tags: z.array(z.string().min(1)),
  sourceRefs: z.array(z.string().min(1)),
  memoryRefs: z.array(UuidSchema),
  freshness: WikiFreshness,
  confidence: Confidence,
  createdAt: IsoUtcDateTimeSchema,
  updatedAt: IsoUtcDateTimeSchema,
  archivedAt: IsoUtcDateTimeSchema.nullable(),
});

export const WikiRevisionSchema = z.object({
  id: UuidSchema,
  wikiPageId: UuidSchema,
  revisionNumber: z.number().int().positive(),
  storageKey: z.string().min(1),
  contentHash: z.string().min(1),
  revisionNote: z.string(),
  sourceRefs: z.array(z.string().min(1)),
  contradictionRefs: z.array(z.string().min(1)),
  createdBy: z.string().min(1),
  auditRef: z.string().nullable(),
  createdAt: IsoUtcDateTimeSchema,
});

export const WikiLinkSchema = z.object({
  id: UuidSchema,
  fromPageId: UuidSchema,
  toPageId: UuidSchema,
  linkType: WikiLinkType,
  createdAt: IsoUtcDateTimeSchema,
});

export type WikiPage = z.infer<typeof WikiPageSchema>;
export type WikiRevision = z.infer<typeof WikiRevisionSchema>;
export type WikiLink = z.infer<typeof WikiLinkSchema>;

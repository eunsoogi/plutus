import { z } from "zod";

export const SourceRefSchema = z.object({
  type: z.string().min(1),
  id: z.string().min(1),
  title: z.string().optional(),
  url: z.string().url().optional(),
});

export type SourceRef = z.infer<typeof SourceRefSchema>;

export const WikiPageCategorySchema = z.enum([
  "thesis",
  "strategy",
  "risk_lesson",
  "instrument",
  "workflow",
  "glossary",
]);

export type WikiPageCategory = z.infer<typeof WikiPageCategorySchema>;

export type WikiMaintenancePlan = z.infer<typeof WikiMaintenancePlanSchema>;

export const WikiMaintenancePlanSchema = z.object({
  runId: z.string().uuid(),
  profileId: z.string().uuid().optional(),
  actions: z.array(
    z.discriminatedUnion("type", [
      z.object({
        type: z.literal("create"),
        category: WikiPageCategorySchema,
        title: z.string(),
        slug: z.string(),
        markdown: z.string(),
        summary: z.string(),
        tags: z.array(z.string()),
        sourceRefs: z.array(SourceRefSchema),
        revisionNote: z.string(),
      }),
      z.object({
        type: z.literal("update"),
        pageId: z.string().uuid(),
        patch: z.string(),
        updatedMarkdown: z.string(),
        sourceRefs: z.array(SourceRefSchema),
        revisionNote: z.string(),
      }),
      z.object({
        type: z.literal("merge"),
        sourcePageIds: z.array(z.string().uuid()),
        targetTitle: z.string(),
        mergedMarkdown: z.string(),
        sourceRefs: z.array(SourceRefSchema),
        revisionNote: z.string(),
      }),
      z.object({
        type: z.literal("archive"),
        pageId: z.string().uuid(),
        reason: z.string(),
        sourceRefs: z.array(SourceRefSchema),
      }),
      z.object({
        type: z.literal("cross_link"),
        fromPageId: z.string().uuid(),
        toPageId: z.string().uuid(),
        linkType: z.enum([
          "supports",
          "contradicts",
          "updates",
          "related",
          "supersedes",
        ]),
        reason: z.string(),
      }),
    ]),
  ),
});

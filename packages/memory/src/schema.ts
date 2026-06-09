import { z } from "zod";

export const SourceRefSchema = z.object({
  type: z.string().min(1),
  id: z.string().min(1),
  title: z.string().optional(),
  url: z.string().url().optional(),
});

export type SourceRef = z.infer<typeof SourceRefSchema>;

export const MemoryKindSchema = z.enum([
  "user_preference",
  "research_memory",
  "strategy_memory",
  "workflow_memory",
  "wiki_source_memory",
  "wiki_pointer",
]);

export type MemoryKind = z.infer<typeof MemoryKindSchema>;

export const MemoryCandidateSchema = z.object({
  kind: MemoryKindSchema,
  summary: z.string().min(1),
  semanticText: z.string().min(1),
  tags: z.array(z.string()),
  sourceRefs: z.array(SourceRefSchema),
  sensitivityClass: z.enum([
    "normal",
    "portfolio_private",
    "account_private",
    "secret_blocked",
  ]),
  retentionClass: z.enum(["default", "pinned", "temporary", "archived"]),
});

export type MemoryCandidate = z.infer<typeof MemoryCandidateSchema>;

import { z } from "zod";

const UuidSchema = z.string().uuid();

export const UpdatePositionThesisInputSchema = z.object({
  portfolioId: UuidSchema,
  positionId: UuidSchema,
  thesis: z.string().min(1),
});

export const UpdateWatchlistItemInputSchema = z.object({
  itemId: UuidSchema,
  note: z.string().min(1).max(4000).optional(),
  triggerNote: z.string().min(1).max(4000).optional(),
});

export const StartResearchRunInputSchema = z.object({
  profileId: z.string().uuid().optional(),
  portfolioId: z.string().min(1),
  symbols: z.array(z.string().min(1)).min(1).optional(),
  thesis: z.string().min(1).optional(),
  userRequest: z.string().min(1).optional(),
});

export const RemoteCommandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("portfolio.list") }),
  z.object({ type: z.literal("portfolio.snapshot"), portfolioId: UuidSchema }),
  z.object({
    type: z.literal("portfolio.update_position_thesis"),
    payload: UpdatePositionThesisInputSchema,
  }),
  z.object({ type: z.literal("watchlist.list") }),
  z.object({
    type: z.literal("watchlist.update_item"),
    payload: UpdateWatchlistItemInputSchema,
  }),
  z.object({
    type: z.literal("run.start"),
    payload: StartResearchRunInputSchema,
  }),
  z.object({ type: z.literal("run.get"), runId: UuidSchema }),
  z.object({ type: z.literal("run.cancel"), runId: UuidSchema }),
  z.object({ type: z.literal("artifact.get"), artifactId: UuidSchema }),
  z.object({ type: z.literal("memory.activity") }),
  z.object({ type: z.literal("wiki.list") }),
  z.object({ type: z.literal("wiki.get"), pageId: UuidSchema }),
]);

export type RemoteCommand = z.infer<typeof RemoteCommandSchema>;

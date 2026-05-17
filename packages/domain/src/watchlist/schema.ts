import { z } from "zod";

import { IsoUtcDateTimeSchema, UuidSchema } from "../ids";

export const TargetZoneSchema = z
  .object({
    lower: z.number().nonnegative().optional(),
    upper: z.number().nonnegative().optional(),
    invalidation: z.number().nonnegative().optional(),
    note: z.string().optional(),
  })
  .refine(
    (targetZone) =>
      targetZone.lower === undefined ||
      targetZone.upper === undefined ||
      targetZone.lower <= targetZone.upper,
    {
      message:
        "targetZone.lower must be less than or equal to targetZone.upper",
    },
  );

export const WatchlistSchema = z
  .object({
    id: UuidSchema,
    profileId: UuidSchema,
    name: z.string().min(1),
    createdAt: IsoUtcDateTimeSchema,
    updatedAt: IsoUtcDateTimeSchema,
    items: z.array(z.unknown()).default([]),
  })
  .passthrough();

export const WatchlistItemSchema = z.object({
  id: UuidSchema,
  watchlistId: UuidSchema,
  instrumentId: UuidSchema,
  triggerNote: z.string(),
  targetZone: TargetZoneSchema,
  createdAt: IsoUtcDateTimeSchema,
  updatedAt: IsoUtcDateTimeSchema,
});

export const CreateWatchlistInputSchema = z.object({
  profileId: UuidSchema,
  name: z.string().min(1),
});

export const AddWatchlistItemInputSchema = z.object({
  watchlistId: UuidSchema,
  instrumentId: UuidSchema,
  triggerNote: z.string().optional(),
  targetZone: TargetZoneSchema.optional(),
});

export const UpdateWatchlistItemInputSchema = z.object({
  itemId: UuidSchema,
  triggerNote: z.string().optional(),
  targetZone: TargetZoneSchema.optional(),
});

export type Watchlist = z.infer<typeof WatchlistSchema>;
export type WatchlistItem = z.infer<typeof WatchlistItemSchema>;
export type UpdateWatchlistItemInput = z.infer<
  typeof UpdateWatchlistItemInputSchema
>;

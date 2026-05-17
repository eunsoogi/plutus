import { z } from "zod";

import { IsoUtcDateTimeSchema, UuidSchema } from "../ids";

export const AccountType = z.enum([
  "manual",
  "cash",
  "broker_readonly",
  "exchange_readonly",
]);

export const AccountSchema = z.object({
  id: UuidSchema,
  profileId: UuidSchema,
  name: z.string().min(1),
  accountType: AccountType,
  baseCurrency: z.string().length(3),
  createdAt: IsoUtcDateTimeSchema,
  updatedAt: IsoUtcDateTimeSchema,
});

export const PortfolioSchema = z
  .object({
    id: UuidSchema,
    profileId: UuidSchema,
    name: z.string().min(1),
    baseCurrency: z.string().length(3),
    benchmarkId: UuidSchema.nullable(),
    riskProfile: z.record(z.string(), z.unknown()),
    createdAt: IsoUtcDateTimeSchema,
    updatedAt: IsoUtcDateTimeSchema,
    positions: z.array(z.unknown()).default([]),
  })
  .passthrough();

export const PositionSchema = z.object({
  id: UuidSchema,
  portfolioId: UuidSchema,
  accountId: UuidSchema,
  instrumentId: UuidSchema,
  quantity: z.number(),
  averageCost: z.number().nonnegative(),
  costCurrency: z.string().length(3),
  feesTotal: z.number().nonnegative(),
  acquiredAt: IsoUtcDateTimeSchema.nullable(),
  riskBucket: z.string().min(1).nullable(),
  tags: z.array(z.string().min(1)),
  thesis: z.string(),
  createdAt: IsoUtcDateTimeSchema,
  updatedAt: IsoUtcDateTimeSchema,
});

export const CreatePortfolioInputSchema = z.object({
  profileId: UuidSchema,
  name: z.string().min(1),
  baseCurrency: z.string().length(3),
  benchmarkId: UuidSchema.optional(),
  riskProfile: z.record(z.string(), z.unknown()).optional(),
});

export const AddPositionInputSchema = z.object({
  portfolioId: UuidSchema,
  accountId: UuidSchema,
  instrumentId: UuidSchema,
  quantity: z.number(),
  averageCost: z.number().nonnegative(),
  costCurrency: z.string().length(3),
  thesis: z.string().optional(),
});

export const UpdatePositionInputSchema = z.object({
  positionId: UuidSchema,
  quantity: z.number().optional(),
  averageCost: z.number().nonnegative().optional(),
  thesis: z.string().optional(),
});

export const UpdatePositionThesisInputSchema = z.object({
  positionId: UuidSchema,
  thesis: z.string().min(1).max(4000),
});

export const GetPortfolioSnapshotInputSchema = z.object({
  portfolioId: UuidSchema,
});

export type Account = z.infer<typeof AccountSchema>;
export type Portfolio = z.infer<typeof PortfolioSchema>;
export type Position = z.infer<typeof PositionSchema>;
export type UpdatePositionThesisInput = z.infer<
  typeof UpdatePositionThesisInputSchema
>;

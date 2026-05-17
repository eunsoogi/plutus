import { z } from "zod";

import { AssetType, DataFreshnessSchema, DelayStatus } from "../common";
import { IsoUtcDateTimeSchema, UuidSchema } from "../ids";

export const InstrumentStatus = z.enum(["active", "delisted", "unsupported"]);

export const InstrumentSchema = z.object({
  id: UuidSchema,
  assetType: AssetType,
  canonicalSymbol: z.string().min(1),
  displaySymbol: z.string().min(1),
  name: z.string().min(1),
  sector: z.string().nullable(),
  category: z.string().nullable(),
  market: z.string().nullable(),
  region: z.string().nullable(),
  currency: z.string().length(3),
  exchange: z.string().nullable(),
  providerRefs: z.record(z.string(), z.string().min(1)),
  status: InstrumentStatus,
  createdAt: IsoUtcDateTimeSchema,
  updatedAt: IsoUtcDateTimeSchema,
});

export const PriceBarSchema = z.object({
  id: UuidSchema,
  instrumentId: UuidSchema,
  provider: z.string().min(1),
  interval: z.string().min(1),
  timestamp: IsoUtcDateTimeSchema,
  timezone: z.string().min(1),
  open: z.number().nonnegative(),
  high: z.number().nonnegative(),
  low: z.number().nonnegative(),
  close: z.number().nonnegative(),
  volume: z.number().nonnegative(),
  adjustedClose: z.number().nonnegative().nullable(),
  sourceMetadata: z.record(z.string(), z.unknown()),
});

export const QuoteSnapshotSchema = z.object({
  id: UuidSchema,
  instrumentId: UuidSchema,
  provider: z.string().min(1),
  asOf: IsoUtcDateTimeSchema,
  price: z.number().nonnegative(),
  currency: z.string().length(3),
  bid: z.number().nonnegative().nullable(),
  ask: z.number().nonnegative().nullable(),
  volume: z.number().nonnegative().nullable(),
  delayStatus: DelayStatus,
  warnings: DataFreshnessSchema.shape.warnings,
  freshness: DataFreshnessSchema,
});

export type Instrument = z.infer<typeof InstrumentSchema>;
export type PriceBar = z.infer<typeof PriceBarSchema>;
export type QuoteSnapshot = z.infer<typeof QuoteSnapshotSchema>;

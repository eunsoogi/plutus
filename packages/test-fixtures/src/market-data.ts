import { DataFreshnessSchema, QuoteSnapshotSchema } from "@plutus/domain";

import { fixtureIds } from "./ids";
import { instrumentMap } from "./instruments";

const freshness = {
  realtime: DataFreshnessSchema.parse({
    provider: "fixture",
    asOf: "2026-05-17T00:00:00.000Z",
    receivedAt: "2026-05-17T00:00:02.000Z",
    delayStatus: "realtime",
    warnings: [],
  }),
  delayed: DataFreshnessSchema.parse({
    provider: "fixture",
    asOf: "2026-05-16T23:45:00.000Z",
    receivedAt: "2026-05-17T00:00:02.000Z",
    delayStatus: "delayed",
    warnings: [
      {
        code: "US_EQUITY_DELAYED",
        severity: "info",
        message: "US equity quote is delayed.",
      },
    ],
  }),
  stale: DataFreshnessSchema.parse({
    provider: "fixture",
    asOf: "2026-05-16T18:00:00.000Z",
    receivedAt: "2026-05-17T00:00:02.000Z",
    delayStatus: "stale",
    warnings: [
      {
        code: "stale_data",
        severity: "warning",
        message: "BTC quote is stale.",
      },
    ],
  }),
  unknown: DataFreshnessSchema.parse({
    provider: "fixture",
    asOf: "2026-05-16T00:00:00.000Z",
    receivedAt: "2026-05-17T00:00:02.000Z",
    delayStatus: "unknown",
    warnings: [
      {
        code: "ETH_SOURCE_UNKNOWN",
        severity: "blocking",
        message: "ETH provider state is unknown.",
      },
    ],
  }),
} as const;

export const marketData = {
  quotes: [
    QuoteSnapshotSchema.parse({
      id: "018f3f5d-0000-7000-8000-000000000301",
      instrumentId: instrumentMap.NVDA.id,
      provider: "fixture",
      asOf: freshness.realtime.asOf,
      price: 924.79,
      currency: "USD",
      bid: 924.5,
      ask: 925,
      volume: 42000000,
      delayStatus: "realtime",
      warnings: freshness.realtime.warnings,
      freshness: freshness.realtime,
    }),
    QuoteSnapshotSchema.parse({
      id: "018f3f5d-0000-7000-8000-000000000302",
      instrumentId: instrumentMap.SPY.id,
      provider: "fixture",
      asOf: freshness.delayed.asOf,
      price: 525.12,
      currency: "USD",
      bid: 525,
      ask: 525.2,
      volume: 77000000,
      delayStatus: "delayed",
      warnings: freshness.delayed.warnings,
      freshness: freshness.delayed,
    }),
    QuoteSnapshotSchema.parse({
      id: "018f3f5d-0000-7000-8000-000000000303",
      instrumentId: instrumentMap.BTC.id,
      provider: "fixture",
      asOf: freshness.stale.asOf,
      price: 67120,
      currency: "USD",
      bid: 67100,
      ask: 67140,
      volume: 21000000000,
      delayStatus: "stale",
      warnings: freshness.stale.warnings,
      freshness: freshness.stale,
    }),
    QuoteSnapshotSchema.parse({
      id: "018f3f5d-0000-7000-8000-000000000304",
      instrumentId: instrumentMap.ETH.id,
      provider: "fixture",
      asOf: freshness.unknown.asOf,
      price: 3220,
      currency: "USD",
      bid: null,
      ask: null,
      volume: null,
      delayStatus: "unknown",
      warnings: freshness.unknown.warnings,
      freshness: freshness.unknown,
    }),
  ],
  freshness,
  defaultBenchmarks: [
    fixtureIds.SPY,
    fixtureIds.QQQ,
    fixtureIds.BTC,
    fixtureIds.ETH,
  ],
} as const;

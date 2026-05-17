import { PriceBarSchema, type PriceBar } from "@plutus/domain";

export type RawCandleRow =
  | [number | string | Date, number, number, number, number, number]
  | {
      timestamp: number | string | Date;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
      adjustedClose?: number | null;
    };

export type NormalizeCandlesInput = {
  instrumentId: string;
  provider: string;
  interval: string;
  timezone?: string;
  rows: RawCandleRow[];
  sourceMetadata?: Record<string, unknown>;
};

function toIsoUtc(value: number | string | Date): string {
  return new Date(value).toISOString();
}

function stablePriceBarId(
  instrumentId: string,
  provider: string,
  interval: string,
  timestamp: string,
): string {
  const seed = `${instrumentId}:${provider}:${interval}:${timestamp}`;
  let hash = 0;
  for (const char of seed) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }

  const tail = hash.toString(16).padStart(8, "0");
  return `018f3f5d-0000-7000-8000-${tail.padStart(12, "0")}`;
}

function readRow(row: RawCandleRow) {
  if (Array.isArray(row)) {
    const [timestamp, open, high, low, close, volume] = row;
    return {
      timestamp,
      open,
      high,
      low,
      close,
      volume,
      adjustedClose: null,
    };
  }

  return {
    timestamp: row.timestamp,
    open: row.open,
    high: row.high,
    low: row.low,
    close: row.close,
    volume: row.volume,
    adjustedClose: row.adjustedClose ?? null,
  };
}

export function normalizeCandles(input: NormalizeCandlesInput): PriceBar[] {
  return input.rows
    .map((row) => {
      const normalized = readRow(row);
      const timestamp = toIsoUtc(normalized.timestamp);
      return PriceBarSchema.parse({
        id: stablePriceBarId(
          input.instrumentId,
          input.provider,
          input.interval,
          timestamp,
        ),
        instrumentId: input.instrumentId,
        provider: input.provider,
        interval: input.interval,
        timestamp,
        timezone: input.timezone ?? "UTC",
        open: normalized.open,
        high: normalized.high,
        low: normalized.low,
        close: normalized.close,
        volume: normalized.volume,
        adjustedClose: normalized.adjustedClose,
        sourceMetadata: input.sourceMetadata ?? {},
      });
    })
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

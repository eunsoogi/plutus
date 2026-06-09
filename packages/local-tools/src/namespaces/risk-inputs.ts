import { corePortfolio, instrumentMap } from "../runtime-reference-data";
import { CURRENT_PRICES } from "./risk-fixtures";

export function requestedSymbols(
  input: unknown,
  field: string,
  fallback: string[],
): string[] {
  const value =
    input && typeof input === "object" && field in input
      ? (input as Record<string, unknown>)[field]
      : undefined;
  if (!Array.isArray(value)) {
    return fallback;
  }
  return value
    .map((item) => symbolFor(String(item)))
    .filter((symbol): symbol is string => Boolean(symbol));
}

export function singleRequestedSymbol(input: unknown): string | undefined {
  return (
    stringInput(input, "symbol") ??
    symbolFor(stringInput(input, "instrumentId")) ??
    symbolFor(stringInput(input, "instrumentIdOrPortfolioId"))
  );
}

function symbolFor(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  const upper = value.toUpperCase();
  if (upper in instrumentMap) {
    return upper;
  }
  return Object.entries(instrumentMap).find(
    ([, instrument]) => instrument.id === value,
  )?.[0];
}

export function stringInput(input: unknown, field: string): string | undefined {
  if (!input || typeof input !== "object" || !(field in input)) {
    return undefined;
  }
  const value = (input as Record<string, unknown>)[field];
  return typeof value === "string" ? value : undefined;
}

export function objectInput(input: unknown, field: string): unknown {
  if (!input || typeof input !== "object" || !(field in input)) {
    return undefined;
  }
  const value = (input as Record<string, unknown>)[field];
  return value && typeof value === "object" ? value : undefined;
}

export function correlationFor(left: string, right: string): number {
  const key = [left, right].sort().join(":");
  return (
    {
      "BTC:NVDA": 0.68,
      "BTC:ETH": 0.74,
      "NVDA:SPY": 0.58,
    }[key] ?? 0.21
  );
}

export function limitsFor(input: unknown): {
  maxSingleAssetWeightPct: number;
  maxCryptoWeightPct: number;
} {
  const limits = objectInput(input, "limits") as
    | {
        maxSingleAssetWeightPct?: unknown;
        maxCryptoWeightPct?: unknown;
      }
    | undefined;
  return {
    maxSingleAssetWeightPct:
      typeof limits?.maxSingleAssetWeightPct === "number"
        ? limits.maxSingleAssetWeightPct
        : Number(corePortfolio.riskProfile.maxSingleAssetWeightPct),
    maxCryptoWeightPct:
      typeof limits?.maxCryptoWeightPct === "number"
        ? limits.maxCryptoWeightPct
        : Number(corePortfolio.riskProfile.maxCryptoWeightPct),
  };
}

export function orderSize(input: unknown, symbol: string): number {
  const assumptions = objectInput(input, "orderSizeAssumptions") as
    | Record<string, unknown>
    | undefined;
  const value = assumptions?.[symbol];
  return typeof value === "number" ? value : 100_000;
}

export function totalMarketValue(): number {
  return corePortfolio.positions.reduce(
    (sum, position) => sum + position.quantity * priceFor(position.symbol),
    0,
  );
}

export function priceFor(symbol: string): number {
  return CURRENT_PRICES[symbol] ?? 1;
}

export function round(value: number, decimals = 2): number {
  const scale = 10 ** decimals;
  return Math.round(value * scale) / scale;
}

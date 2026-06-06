export interface ToolEvidence {
  readonly ok?: boolean;
  readonly data?: unknown;
  readonly warnings: readonly unknown[];
}

export interface AnalysisRunCardInput {
  readonly runId: string;
  readonly profileId: string;
  readonly userRequest: string;
  readonly allocation: ToolEvidence;
  readonly btcQuote: ToolEvidence;
  readonly nvdaQuote: ToolEvidence;
  readonly concentration: ToolEvidence;
  readonly correlation: ToolEvidence;
  readonly liquidity: ToolEvidence;
}

export function weightFor(data: unknown, symbol: string): number | undefined {
  const rows = objectField(data, "allocation");
  if (!Array.isArray(rows)) return undefined;
  const row = rows.find(
    (candidate) => isRecord(candidate) && candidate.symbol === symbol,
  );
  const weight = isRecord(row) ? row.weightPct : undefined;
  return typeof weight === "number" ? weight : undefined;
}

export function correlationFor(data: unknown): number | undefined {
  const matrix = objectField(data, "matrix");
  if (!Array.isArray(matrix)) return undefined;
  const row = matrix.find((candidate) => isRecord(candidate));
  const correlation = isRecord(row) ? row.correlation : undefined;
  return typeof correlation === "number" ? correlation : undefined;
}

export function quoteFreshness(data: unknown, symbol = "BTC"): string {
  const freshness = quoteDelayStatus(data);
  return freshness === "unknown"
    ? `quote:${symbol}`
    : `quote:${symbol}:${freshness}`;
}

export function quoteAvailable(data: unknown): boolean {
  const quote = objectField(data, "quote");
  return isRecord(quote);
}

export function quoteDelayStatus(
  data: unknown,
): "realtime" | "delayed" | "stale" | "unknown" {
  const quote = objectField(data, "quote");
  const directFreshness = isRecord(quote) ? quote.delayStatus : undefined;
  const nestedFreshness = objectField(
    objectField(quote, "freshness"),
    "delayStatus",
  );
  const freshness =
    typeof directFreshness === "string" ? directFreshness : nestedFreshness;
  if (isDelayStatus(freshness)) return freshness;
  return "unknown";
}

export function warningMessages(warnings: readonly unknown[]): string[] {
  return warnings
    .map((item) =>
      isRecord(item) && typeof item.message === "string"
        ? item.message
        : undefined,
    )
    .filter((message): message is string => Boolean(message));
}

export function blockingMessages(input: AnalysisRunCardInput): string[] {
  return [
    ...blockingWarningMessages(input.allocation.warnings),
    ...blockingWarningMessages(input.btcQuote.warnings),
    ...blockingWarningMessages(input.nvdaQuote.warnings),
    ...blockingWarningMessages(input.concentration.warnings),
    ...blockingWarningMessages(input.correlation.warnings),
    ...blockingWarningMessages(input.liquidity.warnings),
  ];
}

function blockingWarningMessages(warnings: readonly unknown[]): string[] {
  return warnings
    .map((item) =>
      isRecord(item) &&
      item.severity === "blocking" &&
      typeof item.message === "string"
        ? item.message
        : undefined,
    )
    .filter((message): message is string => Boolean(message));
}

function isDelayStatus(
  value: unknown,
): value is "realtime" | "delayed" | "stale" | "unknown" {
  return (
    value === "realtime" ||
    value === "delayed" ||
    value === "stale" ||
    value === "unknown"
  );
}

function objectField(value: unknown, field: string): unknown {
  return isRecord(value) ? value[field] : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

import type { OhlcvRequest } from "./provider";
import { resolveProviderSymbol } from "./provider";
import { normalizeCandles } from "../normalization/candles";

export type YahooChartOptions = {
  fetch?: typeof fetch;
  chartEndpoint?: string;
};

const provider = "yahoo-compatible";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readRecord(value: unknown, label: string): Record<string, unknown> {
  if (isRecord(value)) {
    return value;
  }

  throw new Error(`Yahoo-compatible chart response missing ${label}.`);
}

function readArray(value: unknown, label: string): readonly unknown[] {
  if (Array.isArray(value)) {
    return value;
  }

  throw new Error(`Yahoo-compatible chart response missing ${label}.`);
}

function readNumber(value: unknown, label: string): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  throw new Error(`Yahoo-compatible chart response missing ${label}.`);
}

function readOptionalNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function chartUrl(request: OhlcvRequest, options: YahooChartOptions): URL {
  const symbol = resolveProviderSymbol(request, provider);
  const url = new URL(
    options.chartEndpoint ??
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`,
  );
  url.searchParams.set("interval", request.interval);
  url.searchParams.set(
    "period1",
    Math.floor(Date.parse(request.start) / 1000).toString(),
  );
  url.searchParams.set(
    "period2",
    Math.floor(Date.parse(request.end) / 1000).toString(),
  );
  return url;
}

export async function fetchYahooCandles(
  request: OhlcvRequest,
  options: YahooChartOptions,
) {
  if (!options.fetch) {
    throw new Error(
      "Yahoo-compatible network mode requires an injected fetch.",
    );
  }

  const response = await options.fetch(chartUrl(request, options));
  if (!response.ok) {
    throw new Error(
      `Yahoo-compatible chart request failed with HTTP ${response.status}.`,
    );
  }
  const payload: unknown = await response.json();
  const chart = readRecord(readRecord(payload, "chart")["chart"], "chart");
  const result = readArray(chart["result"], "chart.result");
  const firstResult = readRecord(result[0], "chart.result[0]");
  const timestamps = readArray(firstResult["timestamp"], "timestamp");
  const indicators = readRecord(firstResult["indicators"], "indicators");
  const quote = readRecord(
    readArray(indicators["quote"], "indicators.quote")[0],
    "indicators.quote[0]",
  );
  const adjclose = readRecord(
    readArray(indicators["adjclose"], "indicators.adjclose")[0],
    "indicators.adjclose[0]",
  );
  const meta = readRecord(firstResult["meta"], "meta");
  const timezone =
    typeof meta["timezone"] === "string" ? meta["timezone"] : "UTC";
  const openValues = readArray(quote["open"], "quote.open");
  const highValues = readArray(quote["high"], "quote.high");
  const lowValues = readArray(quote["low"], "quote.low");
  const closeValues = readArray(quote["close"], "quote.close");
  const volumeValues = readArray(quote["volume"], "quote.volume");
  const adjustedCloseValues = readArray(
    adjclose["adjclose"],
    "adjclose.adjclose",
  );

  return normalizeCandles({
    instrumentId: request.instrumentId,
    provider,
    interval: request.interval,
    timezone,
    rows: timestamps.map((timestampValue, index) => ({
      timestamp: readNumber(timestampValue, `timestamp[${index}]`) * 1000,
      open: readNumber(openValues[index], "open"),
      high: readNumber(highValues[index], "high"),
      low: readNumber(lowValues[index], "low"),
      close: readNumber(closeValues[index], "close"),
      volume: readNumber(volumeValues[index], "volume"),
      adjustedClose: readOptionalNumber(adjustedCloseValues[index]),
    })),
    sourceMetadata: {
      source: "yahoo-compatible-chart",
      timezone,
    },
  });
}

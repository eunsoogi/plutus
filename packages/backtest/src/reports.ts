import { BACKTEST_PAST_PERFORMANCE_CAVEAT } from "./schema";
import type { BacktestResult } from "./types";

export function renderBacktestMarkdownReport(result: BacktestResult): string {
  const rows = Object.entries(result.metrics)
    .map(([name, metric]) => {
      if (typeof metric === "number") return `| ${name} | ${metric} | n/a |`;
      return `| ${name} | ${metric.value} | ${metric.calculationPeriod.start} to ${metric.calculationPeriod.end} |`;
    })
    .join("\n");
  return [
    `# ${result.strategy.name}`,
    "",
    `Run ID: ${result.runId}`,
    "",
    "## Assumptions",
    `Fee: ${result.assumptions.feeBps} bps; slippage: ${result.assumptions.slippageBps} bps; starting capital: ${result.assumptions.startingCapital} ${result.assumptions.currency}.`,
    "",
    "## Metrics",
    "| Metric | Value | Period |",
    "| --- | ---: | --- |",
    rows,
    "",
    "## Data Sources",
    result.dataSourceRefs.map((ref) => `- ${ref}`).join("\n"),
    "",
    "## Warnings",
    result.warnings.map((warning) => `- ${warning}`).join("\n"),
    "",
    "## Caveat",
    BACKTEST_PAST_PERFORMANCE_CAVEAT,
    "",
    "## Rerun",
    "Change the strategy timeRange and rerun through plutus_backtest.run_backtest.",
  ].join("\n");
}

export const renderBacktestMarkdown = renderBacktestMarkdownReport;

export function renderBacktestHtmlReport(result: BacktestResult): string {
  return `<article><h1>${escapeHtml(result.strategy.name)}</h1><p>${BACKTEST_PAST_PERFORMANCE_CAVEAT}</p><pre>${escapeHtml(
    renderBacktestMarkdownReport(result),
  )}</pre></article>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

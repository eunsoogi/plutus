import { defaultWatchlist } from "../runtime-reference-data";
import type { NamespaceHandler } from "./common";
import { allowFixtureTools, ok, warning } from "./common";
import { activePortfolios } from "./portfolio-fixtures";
import {
  allocationRows,
  instrumentNotes,
  performance,
  portfolioSummary,
  positionHistory,
  snapshot,
} from "./portfolio-metrics";
import {
  groupByFor,
  portfolioAccessWarning,
  portfolioFor,
  portfolioStateFor,
} from "./portfolio-state";

export const handlePortfolio: NamespaceHandler = ({
  call,
  context,
  runtime,
  auditRef,
}) => {
  const state = portfolioStateFor(context.appDataPath);
  const allowFixtureFallback = allowFixtureTools();
  const portfolios = (
    state?.portfolios ?? (allowFixtureFallback ? activePortfolios : [])
  ).filter((candidate) => candidate.profileId === context.profileId);
  const watchlists = (
    state?.watchlists ?? (allowFixtureFallback ? [defaultWatchlist] : [])
  ).filter((candidate) => candidate.profileId === context.profileId);
  const accessWarning = portfolioAccessWarning(
    call.input,
    context.profileId,
    portfolios,
  );
  if (accessWarning) {
    return ok(auditRef, "plutus_portfolio", undefined, [accessWarning]);
  }

  const portfolio = portfolioFor(call.input, portfolios);
  runtime.records.set(`portfolio_state_source_${context.runId}`, {
    source: state
      ? "tauri_export"
      : allowFixtureFallback
        ? "fixtures"
        : "missing_app_data",
    appDataPath: context.appDataPath,
  });

  switch (call.tool) {
    case "list_portfolios":
      return ok(auditRef, "plutus_portfolio", {
        portfolios: portfolios
          .filter((candidate) => candidate.profileId === context.profileId)
          .map((candidate) => portfolioSummary(candidate)),
      });
    case "get_portfolio_snapshot":
      if (!portfolio) return missingPortfolioState(auditRef);
      return ok(
        auditRef,
        "plutus_portfolio",
        snapshot(portfolio, allowFixtureFallback),
      );
    case "compute_allocation":
      if (!portfolio) return missingPortfolioState(auditRef);
      return ok(auditRef, "plutus_portfolio", {
        portfolioId: portfolio.id,
        asOf: "2026-05-17T00:00:00.000Z",
        allocation: allocationRows(
          portfolio,
          groupByFor(call.input),
          allowFixtureFallback,
        ),
      });
    case "compute_performance":
      if (!portfolio) return missingPortfolioState(auditRef);
      return ok(auditRef, "plutus_portfolio", {
        portfolioId: portfolio.id,
        performance: performance(portfolio, call.input, allowFixtureFallback),
      });
    case "get_position_history":
      if (!portfolio) return missingPortfolioState(auditRef);
      return ok(auditRef, "plutus_portfolio", {
        portfolioId: portfolio.id,
        events: positionHistory(portfolio, call.input),
      });
    case "get_watchlists":
      return ok(auditRef, "plutus_portfolio", {
        watchlists,
      });
    case "get_instrument_notes":
      return ok(auditRef, "plutus_portfolio", {
        notes: instrumentNotes(call.input, portfolios, watchlists),
      });
    default:
      return ok(auditRef, "plutus_portfolio", undefined, [
        warning(
          "unsupported_portfolio_tool",
          "blocking",
          `${call.tool} is not implemented by plutus_portfolio.`,
        ),
      ]);
  }
};

function missingPortfolioState(auditRef: string) {
  return ok(auditRef, "plutus_portfolio", undefined, [
    warning(
      "portfolio_state_unavailable",
      "blocking",
      "No exported app portfolio state is available for this run.",
    ),
  ]);
}

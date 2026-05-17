import {
  accounts,
  corePortfolio,
  defaultWatchlist,
  fixtureIds,
  instrumentMap,
  marketData,
} from "@plutus/test-fixtures";

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { NamespaceHandler } from "./common";
import { ok, warning } from "./common";

const CURRENT_PRICES: Record<string, number> = {
  AAPL: 212.5,
  NVDA: 924.79,
  BTC: 67120,
  ETH: 3220,
  USDC: 1,
  USD: 1,
  SPY: 525.12,
  QQQ: 452.4,
};

const CRYPTO_SLEEVE_PORTFOLIO_ID = "018f3f5d-0000-7000-8000-000000000202";

const cryptoSleevePortfolio = {
  ...corePortfolio,
  id: CRYPTO_SLEEVE_PORTFOLIO_ID,
  name: "Crypto Sleeve",
  benchmarkId: fixtureIds.BTC,
  positions: corePortfolio.positions
    .filter((position) => ["BTC", "ETH", "USDC"].includes(position.symbol))
    .map((position) => ({
      ...position,
      id: `${position.id.slice(0, -1)}9`,
      portfolioId: CRYPTO_SLEEVE_PORTFOLIO_ID,
    })),
};

const activePortfolios = [corePortfolio, cryptoSleevePortfolio];

type PortfolioFixture = (typeof activePortfolios)[number];
type PortfolioLike = PortfolioFixture & {
  positions: PortfolioFixture["positions"];
};

type AllocationGroupBy =
  | "position"
  | "sector"
  | "category"
  | "currency"
  | "account"
  | "riskBucket"
  | "tag";

export const handlePortfolio: NamespaceHandler = ({
  call,
  context,
  runtime,
  auditRef,
}) => {
  const state = portfolioStateFor(context.appDataPath);
  const portfolios = state?.portfolios ?? activePortfolios;
  const watchlists = state?.watchlists ?? [defaultWatchlist];
  const accessWarning = portfolioAccessWarning(
    call.input,
    context.profileId,
    portfolios,
  );
  if (accessWarning) {
    return ok(auditRef, "plutus_portfolio", undefined, [accessWarning]);
  }

  const portfolio =
    portfolioFor(call.input, portfolios) ?? portfolios[0] ?? corePortfolio;
  runtime.records.set(`portfolio_state_source_${context.runId}`, {
    source: state ? "tauri_export" : "fixtures",
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
      return ok(auditRef, "plutus_portfolio", snapshot(portfolio));
    case "compute_allocation":
      return ok(auditRef, "plutus_portfolio", {
        portfolioId: portfolio.id,
        asOf: "2026-05-17T00:00:00.000Z",
        allocation: allocationRows(portfolio, groupByFor(call.input)),
      });
    case "compute_performance":
      return ok(auditRef, "plutus_portfolio", {
        portfolioId: portfolio.id,
        performance: performance(portfolio, call.input),
      });
    case "get_position_history":
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
        notes: instrumentNotes(call.input),
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

function portfolioSummary(portfolio: PortfolioLike) {
  return {
    id: portfolio.id,
    profileId: portfolio.profileId,
    name: portfolio.name,
    baseCurrency: portfolio.baseCurrency,
    benchmarkId: portfolio.benchmarkId,
    positionCount: portfolio.positions.length,
    marketValue: round(totalMarketValue(portfolio)),
  };
}

function snapshot(portfolio: PortfolioLike) {
  return {
    portfolio: portfolioSummary(portfolio),
    positions: portfolio.positions.map((position) => {
      const currentPrice =
        CURRENT_PRICES[position.symbol] ?? position.averageCost;
      const marketValue = position.quantity * currentPrice;
      return {
        ...position,
        currentPrice,
        marketValue: round(marketValue),
        unrealizedPnl: round(
          marketValue - position.quantity * position.averageCost,
        ),
        quote: marketData.quotes.find(
          (quote) => quote.instrumentId === position.instrumentId,
        ),
      };
    }),
  };
}

function allocationRows(portfolio: PortfolioLike, groupBy: AllocationGroupBy) {
  const total = totalMarketValue(portfolio);
  const rows = portfolio.positions.map((position) => {
    const marketValue =
      position.quantity *
      (CURRENT_PRICES[position.symbol] ?? position.averageCost);
    const instrument = instrumentBySymbol(position.symbol);
    return {
      symbol: position.symbol,
      instrumentId: position.instrumentId,
      assetType: instrument?.assetType,
      marketValue: round(marketValue),
      weightPct: round((marketValue / total) * 100),
      riskBucket: position.riskBucket,
      sector: instrument?.sector ?? "Unclassified",
      category: instrument?.category ?? "Unclassified",
      currency: instrument?.currency ?? position.costCurrency,
      account: accountName(position.accountId) ?? "Unknown account",
      tags: position.tags,
    };
  });

  if (groupBy === "position") {
    return rows.map((row) => ({ ...row, groupBy, groupKey: row.symbol }));
  }

  const groups = new Map<string, { marketValue: number; symbols: string[] }>();
  for (const row of rows) {
    const keys =
      groupBy === "tag"
        ? row.tags.length
          ? row.tags
          : ["untagged"]
        : [String(row[groupBy] ?? "Unclassified")];
    for (const key of keys) {
      const existing = groups.get(key) ?? { marketValue: 0, symbols: [] };
      existing.marketValue += row.marketValue;
      existing.symbols.push(row.symbol);
      groups.set(key, existing);
    }
  }

  return [...groups.entries()].map(([groupKey, group]) => ({
    groupBy,
    groupKey,
    symbols: group.symbols,
    marketValue: round(group.marketValue),
    weightPct: round((group.marketValue / total) * 100),
  }));
}

function performance(portfolio: PortfolioLike, input: unknown) {
  const start =
    input && typeof input === "object" && "start" in input
      ? String((input as { start: unknown }).start)
      : "2026-01-01";
  const end =
    input && typeof input === "object" && "end" in input
      ? String((input as { end: unknown }).end)
      : "2026-05-17";
  const costBasis = portfolio.positions.reduce(
    (sum, position) => sum + position.quantity * position.averageCost,
    0,
  );
  const value = totalMarketValue(portfolio);
  const benchmarkId =
    input && typeof input === "object" && "benchmarkId" in input
      ? String((input as { benchmarkId: unknown }).benchmarkId)
      : fixtureIds.SPY;
  return {
    start,
    end,
    totalReturnPct: round(((value - costBasis) / costBasis) * 100),
    benchmarkId,
    benchmarkReturnPct: 7.4,
    excessReturnPct: round(((value - costBasis) / costBasis) * 100 - 7.4),
    marketValue: round(value),
    costBasis: round(costBasis),
  };
}

function positionHistory(portfolio: PortfolioLike, input: unknown) {
  const positionId =
    input && typeof input === "object" && "positionId" in input
      ? String((input as { positionId: unknown }).positionId)
      : undefined;
  const instrumentId =
    input && typeof input === "object" && "instrumentId" in input
      ? String((input as { instrumentId: unknown }).instrumentId)
      : undefined;
  const symbol =
    input && typeof input === "object" && "symbol" in input
      ? String((input as { symbol: unknown }).symbol).toUpperCase()
      : undefined;

  return portfolio.positions
    .filter(
      (position) =>
        (!positionId || position.id === positionId) &&
        (!instrumentId || position.instrumentId === instrumentId) &&
        (!symbol || position.symbol === symbol),
    )
    .map((position) => ({
      positionId: position.id,
      instrumentId: position.instrumentId,
      symbol: position.symbol,
      acquiredAt: position.acquiredAt,
      quantity: position.quantity,
      averageCost: position.averageCost,
    }));
}

function instrumentNotes(input: unknown) {
  const symbol =
    input && typeof input === "object" && "symbol" in input
      ? String((input as { symbol: unknown }).symbol).toUpperCase()
      : undefined;
  const instrumentId =
    input && typeof input === "object" && "instrumentId" in input
      ? String((input as { instrumentId: unknown }).instrumentId)
      : undefined;
  return [
    ...corePortfolio.positions
      .filter(
        (position) =>
          (!symbol || position.symbol === symbol) &&
          (!instrumentId || position.instrumentId === instrumentId),
      )
      .map((position) => ({
        id: `note_${position.id}`,
        symbol: position.symbol,
        instrumentId: position.instrumentId,
        text: position.thesis,
        source: "position_thesis",
      })),
    ...defaultWatchlist.items
      .filter(
        (item) =>
          (!symbol || item.symbol === symbol) &&
          (!instrumentId || item.instrumentId === instrumentId),
      )
      .map((item) => ({
        id: `note_${item.id}`,
        symbol: item.symbol,
        instrumentId: item.instrumentId,
        text: item.triggerNote,
        source: "watchlist_trigger",
      })),
  ];
}

function totalMarketValue(portfolio: PortfolioLike) {
  return portfolio.positions.reduce(
    (sum, position) =>
      sum +
      position.quantity *
        (CURRENT_PRICES[position.symbol] ?? position.averageCost),
    0,
  );
}

function instrumentBySymbol(symbol: string) {
  return instrumentMap[symbol as keyof typeof instrumentMap];
}

function accountName(accountId: string) {
  return Object.values(accounts).find((account) => account.id === accountId)
    ?.name;
}

function groupByFor(input: unknown): AllocationGroupBy {
  if (!input || typeof input !== "object" || !("groupBy" in input)) {
    return "position";
  }
  const groupBy = String((input as { groupBy: unknown }).groupBy);
  return [
    "sector",
    "category",
    "currency",
    "account",
    "riskBucket",
    "tag",
  ].includes(groupBy)
    ? (groupBy as AllocationGroupBy)
    : "position";
}

function portfolioFor(
  input: unknown,
  portfolios: PortfolioLike[],
): PortfolioLike | undefined {
  const portfolioId =
    input && typeof input === "object" && "portfolioId" in input
      ? String((input as { portfolioId: unknown }).portfolioId)
      : undefined;
  return portfolioId
    ? portfolios.find((portfolio) => portfolio.id === portfolioId)
    : (portfolios[0] ?? corePortfolio);
}

function portfolioAccessWarning(
  input: unknown,
  profileId: string,
  portfolios: PortfolioLike[],
) {
  const requestedProfileId =
    input && typeof input === "object" && "profileId" in input
      ? String((input as { profileId: unknown }).profileId)
      : undefined;
  if (requestedProfileId && requestedProfileId !== profileId) {
    return warning(
      "portfolio_outside_active_profile",
      "blocking",
      "Portfolio tools cannot read portfolios outside the active profile.",
    );
  }

  const requestedPortfolioId =
    input && typeof input === "object" && "portfolioId" in input
      ? String((input as { portfolioId: unknown }).portfolioId)
      : undefined;
  if (
    requestedPortfolioId &&
    !portfolios.some(
      (portfolio) =>
        portfolio.id === requestedPortfolioId &&
        portfolio.profileId === profileId,
    )
  ) {
    return warning(
      "portfolio_outside_active_profile",
      "blocking",
      "Portfolio tools cannot read portfolios outside the active profile.",
    );
  }
  return undefined;
}

function portfolioStateFor(appDataPath: string | undefined):
  | {
      portfolios: PortfolioLike[];
      watchlists: Array<typeof defaultWatchlist>;
    }
  | undefined {
  if (!appDataPath) return undefined;
  const path = join(appDataPath, "local-tools", "portfolio-state.json");
  if (!existsSync(path)) return undefined;
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as {
      portfolios?: unknown;
      watchlists?: unknown;
    };
    if (!Array.isArray(parsed.portfolios)) return undefined;
    return {
      portfolios: parsed.portfolios as PortfolioLike[],
      watchlists: Array.isArray(parsed.watchlists)
        ? (parsed.watchlists as Array<typeof defaultWatchlist>)
        : [defaultWatchlist],
    };
  } catch {
    return undefined;
  }
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

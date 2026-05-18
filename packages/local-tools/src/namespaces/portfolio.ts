import {
  accounts,
  corePortfolio,
  defaultWatchlist,
  fixtureIds,
  instrumentMap,
  marketData,
} from "../runtime-reference-data";

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { NamespaceHandler } from "./common";
import { allowFixtureTools, ok, warning } from "./common";

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

function portfolioSummary(portfolio: PortfolioLike) {
  return {
    id: portfolio.id,
    profileId: portfolio.profileId,
    name: portfolio.name,
    baseCurrency: portfolio.baseCurrency,
    benchmarkId: portfolio.benchmarkId,
    positionCount: portfolio.positions.length,
    marketValue: round(totalMarketValue(portfolio, allowFixtureTools())),
  };
}

function snapshot(portfolio: PortfolioLike, allowFixtures: boolean) {
  return {
    portfolio: portfolioSummary(portfolio),
    positions: portfolio.positions.map((position) => {
      const currentPrice = priceFor(position, allowFixtures);
      const quantity = numericPositionField(position, "quantity");
      const averageCost = numericPositionField(position, "averageCost");
      const marketValue = quantity * currentPrice;
      return {
        ...position,
        quantity,
        averageCost,
        currentPrice,
        marketValue: round(marketValue),
        unrealizedPnl: round(marketValue - quantity * averageCost),
        quote: allowFixtures
          ? marketData.quotes.find(
              (quote) => quote.instrumentId === positionInstrumentId(position),
            )
          : undefined,
      };
    }),
  };
}

function allocationRows(
  portfolio: PortfolioLike,
  groupBy: AllocationGroupBy,
  allowFixtures: boolean,
) {
  const total = totalMarketValue(portfolio, allowFixtures);
  const rows = portfolio.positions.map((position) => {
    const quantity = numericPositionField(position, "quantity");
    const marketValue = quantity * priceFor(position, allowFixtures);
    const instrument = instrumentBySymbol(position.symbol, allowFixtures);
    const tags = positionTags(position);
    return {
      symbol: position.symbol,
      instrumentId: positionInstrumentId(position),
      assetType: instrument?.assetType,
      marketValue: round(marketValue),
      weightPct: round((marketValue / total) * 100),
      riskBucket: positionRiskBucket(position),
      sector: instrument?.sector ?? "Unclassified",
      category: instrument?.category ?? "Unclassified",
      currency: instrument?.currency ?? positionCostCurrency(position),
      account:
        accountName(positionAccountId(position), allowFixtures) ??
        "Unknown account",
      tags,
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

function performance(
  portfolio: PortfolioLike,
  input: unknown,
  allowFixtures: boolean,
) {
  const start =
    input && typeof input === "object" && "start" in input
      ? String((input as { start: unknown }).start)
      : "2026-01-01";
  const end =
    input && typeof input === "object" && "end" in input
      ? String((input as { end: unknown }).end)
      : "2026-05-17";
  const costBasis = portfolio.positions.reduce(
    (sum, position) =>
      sum +
      numericPositionField(position, "quantity") *
        numericPositionField(position, "averageCost"),
    0,
  );
  const value = totalMarketValue(portfolio, allowFixtures);
  const benchmarkId =
    input && typeof input === "object" && "benchmarkId" in input
      ? String((input as { benchmarkId: unknown }).benchmarkId)
      : allowFixtures
        ? fixtureIds.SPY
        : portfolio.benchmarkId;
  const totalReturnPct = costBasis
    ? round(((value - costBasis) / costBasis) * 100)
    : 0;
  const benchmarkReturnPct = allowFixtures ? 7.4 : 0;
  return {
    start,
    end,
    totalReturnPct,
    benchmarkId,
    benchmarkReturnPct,
    excessReturnPct: round(totalReturnPct - benchmarkReturnPct),
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
        (!instrumentId || positionInstrumentId(position) === instrumentId) &&
        (!symbol || position.symbol === symbol),
    )
    .map((position) => ({
      positionId: position.id,
      instrumentId: positionInstrumentId(position),
      symbol: position.symbol,
      acquiredAt: positionAcquiredAt(position),
      quantity: numericPositionField(position, "quantity"),
      averageCost: numericPositionField(position, "averageCost"),
    }));
}

function instrumentNotes(
  input: unknown,
  portfolios: PortfolioLike[],
  watchlists: Array<typeof defaultWatchlist>,
) {
  const symbol =
    input && typeof input === "object" && "symbol" in input
      ? String((input as { symbol: unknown }).symbol).toUpperCase()
      : undefined;
  const instrumentId =
    input && typeof input === "object" && "instrumentId" in input
      ? String((input as { instrumentId: unknown }).instrumentId)
      : undefined;
  return [
    ...portfolios
      .flatMap((portfolio) => portfolio.positions)
      .filter(
        (position) =>
          (!symbol || position.symbol === symbol) &&
          (!instrumentId || positionInstrumentId(position) === instrumentId),
      )
      .map((position) => ({
        id: `note_${position.id}`,
        symbol: position.symbol,
        instrumentId: positionInstrumentId(position),
        text: positionThesis(position),
        source: "position_thesis",
      })),
    ...watchlists
      .flatMap((watchlist) => watchlist.items)
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

function totalMarketValue(portfolio: PortfolioLike, allowFixtures: boolean) {
  return portfolio.positions.reduce(
    (sum, position) =>
      sum +
      numericPositionField(position, "quantity") *
        priceFor(position, allowFixtures),
    0,
  );
}

function priceFor(
  position: PortfolioLike["positions"][number],
  allowFixtures: boolean,
) {
  return allowFixtures
    ? (CURRENT_PRICES[position.symbol] ?? position.averageCost)
    : numericPositionField(position, "averageCost");
}

function numericPositionField(
  position: PortfolioLike["positions"][number],
  field: "quantity" | "averageCost",
) {
  const value = position[field];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function positionTags(position: PortfolioLike["positions"][number]) {
  return Array.isArray(position.tags) ? position.tags.map(String) : [];
}

function positionInstrumentId(position: PortfolioLike["positions"][number]) {
  return typeof position.instrumentId === "string" ? position.instrumentId : "";
}

function positionAccountId(position: PortfolioLike["positions"][number]) {
  return typeof position.accountId === "string" ? position.accountId : "";
}

function positionCostCurrency(position: PortfolioLike["positions"][number]) {
  return typeof position.costCurrency === "string"
    ? position.costCurrency
    : "USD";
}

function positionRiskBucket(position: PortfolioLike["positions"][number]) {
  return typeof position.riskBucket === "string"
    ? position.riskBucket
    : "Unclassified";
}

function positionAcquiredAt(position: PortfolioLike["positions"][number]) {
  return typeof position.acquiredAt === "string"
    ? position.acquiredAt
    : undefined;
}

function positionThesis(position: PortfolioLike["positions"][number]) {
  return typeof position.thesis === "string" ? position.thesis : "";
}

function instrumentBySymbol(symbol: string, allowFixtures: boolean) {
  if (!allowFixtures) return undefined;
  return instrumentMap[symbol as keyof typeof instrumentMap];
}

function accountName(accountId: string, allowFixtures: boolean) {
  if (!allowFixtures) return undefined;
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
    : portfolios[0];
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
        : [],
    };
  } catch {
    return undefined;
  }
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

import {
  defaultWatchlist,
  fixtureIds,
  marketData,
} from "../runtime-reference-data";
import { allowFixtureTools } from "./common";
import type { AllocationGroupBy, PortfolioLike } from "./portfolio-fixtures";
import {
  accountName,
  instrumentBySymbol,
  numericPositionField,
  positionAccountId,
  positionAcquiredAt,
  positionCostCurrency,
  positionInstrumentId,
  positionRiskBucket,
  positionTags,
  positionThesis,
  priceFor,
  round,
  totalMarketValue,
} from "./portfolio-values";

export function portfolioSummary(portfolio: PortfolioLike) {
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

export function snapshot(portfolio: PortfolioLike, allowFixtures: boolean) {
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

export function allocationRows(
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

export function performance(
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

export function positionHistory(portfolio: PortfolioLike, input: unknown) {
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

export function instrumentNotes(
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

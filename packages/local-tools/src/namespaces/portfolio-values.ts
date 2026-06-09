import { accounts, instrumentMap } from "../runtime-reference-data";
import { CURRENT_PRICES, type PortfolioLike } from "./portfolio-fixtures";

export function totalMarketValue(
  portfolio: PortfolioLike,
  allowFixtures: boolean,
) {
  return portfolio.positions.reduce(
    (sum, position) =>
      sum +
      numericPositionField(position, "quantity") *
        priceFor(position, allowFixtures),
    0,
  );
}

export function priceFor(
  position: PortfolioLike["positions"][number],
  allowFixtures: boolean,
) {
  return allowFixtures
    ? (CURRENT_PRICES[position.symbol] ?? position.averageCost)
    : numericPositionField(position, "averageCost");
}

export function numericPositionField(
  position: PortfolioLike["positions"][number],
  field: "quantity" | "averageCost",
) {
  const value = position[field];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function positionTags(position: PortfolioLike["positions"][number]) {
  return Array.isArray(position.tags) ? position.tags.map(String) : [];
}

export function positionInstrumentId(
  position: PortfolioLike["positions"][number],
) {
  return typeof position.instrumentId === "string" ? position.instrumentId : "";
}

export function positionAccountId(
  position: PortfolioLike["positions"][number],
) {
  return typeof position.accountId === "string" ? position.accountId : "";
}

export function positionCostCurrency(
  position: PortfolioLike["positions"][number],
) {
  return typeof position.costCurrency === "string"
    ? position.costCurrency
    : "USD";
}

export function positionRiskBucket(
  position: PortfolioLike["positions"][number],
) {
  return typeof position.riskBucket === "string"
    ? position.riskBucket
    : "Unclassified";
}

export function positionAcquiredAt(
  position: PortfolioLike["positions"][number],
) {
  return typeof position.acquiredAt === "string"
    ? position.acquiredAt
    : undefined;
}

export function positionThesis(position: PortfolioLike["positions"][number]) {
  return typeof position.thesis === "string" ? position.thesis : "";
}

export function instrumentBySymbol(symbol: string, allowFixtures: boolean) {
  if (!allowFixtures) return undefined;
  return instrumentMap[symbol as keyof typeof instrumentMap];
}

export function accountName(accountId: string, allowFixtures: boolean) {
  if (!allowFixtures) return undefined;
  return Object.values(accounts).find((account) => account.id === accountId)
    ?.name;
}

export function round(value: number): number {
  return Math.round(value * 100) / 100;
}

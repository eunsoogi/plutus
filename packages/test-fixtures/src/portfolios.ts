import { AccountSchema, PortfolioSchema, PositionSchema } from "@plutus/domain";

import { fixtureIds, fixtureNow } from "./ids";
import { instrumentMap } from "./instruments";

export const accounts = {
  manual: AccountSchema.parse({
    id: fixtureIds.manualAccount,
    profileId: fixtureIds.profile,
    name: "Manual Holdings",
    accountType: "manual",
    baseCurrency: "USD",
    createdAt: fixtureNow,
    updatedAt: fixtureNow,
  }),
  cash: AccountSchema.parse({
    id: fixtureIds.cashAccount,
    profileId: fixtureIds.profile,
    name: "Cash",
    accountType: "cash",
    baseCurrency: "USD",
    createdAt: fixtureNow,
    updatedAt: fixtureNow,
  }),
} as const;

const position = (
  symbol: keyof typeof instrumentMap,
  quantity: number,
  averageCost: number,
  riskBucket: string,
  thesis: string,
) =>
  PositionSchema.parse({
    id: `018f3f5d-0000-7000-8000-0000000002${Object.keys(instrumentMap).indexOf(symbol).toString().padStart(2, "0")}`,
    portfolioId: fixtureIds.corePortfolio,
    accountId:
      symbol === "USD" ? fixtureIds.cashAccount : fixtureIds.manualAccount,
    instrumentId: instrumentMap[symbol].id,
    quantity,
    averageCost,
    costCurrency: "USD",
    feesTotal: 0,
    acquiredAt: "2026-01-15T00:00:00.000Z",
    riskBucket,
    tags: symbol === "BTC" || symbol === "NVDA" ? ["concentration-review"] : [],
    thesis,
    createdAt: fixtureNow,
    updatedAt: fixtureNow,
  });

const instrumentsById = Object.fromEntries(
  Object.entries(instrumentMap).map(([symbol, instrument]) => [
    instrument.id,
    symbol,
  ]),
) as Record<string, keyof typeof instrumentMap>;

export const corePortfolio = {
  ...PortfolioSchema.parse({
    id: fixtureIds.corePortfolio,
    profileId: fixtureIds.profile,
    name: "Core",
    baseCurrency: "USD",
    benchmarkId: fixtureIds.SPY,
    riskProfile: {
      maxSingleAssetWeightPct: 25,
      maxCryptoWeightPct: 20,
    },
    createdAt: fixtureNow,
    updatedAt: fixtureNow,
  }),
  positions: [
    position(
      "AAPL",
      12,
      185,
      "growth_equity",
      "Durable consumer platform exposure.",
    ),
    position(
      "NVDA",
      8,
      760,
      "ai_semiconductor",
      "AI infrastructure upside with valuation risk.",
    ),
    position(
      "BTC",
      0.42,
      63000,
      "digital_asset",
      "Long-term store-of-value exposure.",
    ),
    position(
      "ETH",
      2.4,
      3100,
      "digital_asset",
      "Smart-contract platform exposure.",
    ),
    position("USDC", 2500, 1, "cash_equivalent", "Stablecoin dry powder."),
    position("USD", 5000, 1, "cash", "Fiat cash reserve."),
  ].map((parsedPosition) => ({
    ...parsedPosition,
    symbol: instrumentsById[parsedPosition.instrumentId],
  })),
} as const;

import { corePortfolio, fixtureIds } from "../runtime-reference-data";

export const CURRENT_PRICES: Record<string, number> = {
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

export const activePortfolios = [corePortfolio, cryptoSleevePortfolio];

export type PortfolioFixture = (typeof activePortfolios)[number];
export type PortfolioLike = PortfolioFixture & {
  positions: PortfolioFixture["positions"];
};

export type AllocationGroupBy =
  | "position"
  | "sector"
  | "category"
  | "currency"
  | "account"
  | "riskBucket"
  | "tag";

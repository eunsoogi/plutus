import { describe, expect, it } from "vitest";
import {
  InstrumentSchema,
  PortfolioSchema,
  QuoteSnapshotSchema,
  ResearchRunSchema,
  WatchlistSchema,
} from "@plutus/domain";
import {
  corePortfolio,
  defaultWatchlist,
  instruments,
  mvpScenario,
  quotes,
} from "./index";

describe("MVP fixtures", () => {
  it("contains the complete required instrument universe", () => {
    expect(instruments.map((item) => item.canonicalSymbol).sort()).toEqual([
      "AAPL",
      "BTC",
      "ETH",
      "NVDA",
      "QQQ",
      "SPY",
      "USD",
      "USDC",
    ]);
    instruments.forEach((item) =>
      expect(InstrumentSchema.parse(item).id).toBe(item.id),
    );
  });

  it("seeds Core portfolio, watchlist, stale quote warning, and acceptance run", () => {
    expect(PortfolioSchema.parse(corePortfolio).name).toBe("Core");
    expect(
      WatchlistSchema.parse(defaultWatchlist).items.length,
    ).toBeGreaterThan(0);
    expect(
      quotes.some((quote) =>
        QuoteSnapshotSchema.parse(quote).warnings.some(
          (warning) => warning.code === "stale_data",
        ),
      ),
    ).toBe(true);
    expect(
      ResearchRunSchema.parse(mvpScenario.runs[0]).recommendationCategory,
    ).toBe("risk_warning");
  });
});

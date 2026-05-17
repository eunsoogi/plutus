import { describe, expect, it } from "vitest";

import {
  acceptanceResearchRun,
  corePortfolio,
  defaultWatchlist,
  instrumentMap,
  marketData,
  remoteDevices,
} from "./index";

describe("MVP deterministic fixtures", () => {
  it("include the required instruments", () => {
    expect(Object.keys(instrumentMap).sort()).toEqual([
      "AAPL",
      "BTC",
      "ETH",
      "NVDA",
      "QQQ",
      "SPY",
      "USD",
      "USDC",
    ]);
  });

  it("seeds Core with BTC/NVDA exposure and the required default watchlist", () => {
    expect(corePortfolio.name).toBe("Core");
    expect(
      corePortfolio.positions.map((position) => position.symbol).sort(),
    ).toEqual(["AAPL", "BTC", "ETH", "NVDA", "USD", "USDC"]);
    expect(defaultWatchlist.items.map((item) => item.symbol)).toEqual([
      "SPY",
      "QQQ",
      "BTC",
      "ETH",
      "NVDA",
    ]);
  });

  it("contains explicit freshness states for market data", () => {
    expect(
      marketData.quotes.map((quote) => quote.freshness.delayStatus).sort(),
    ).toEqual(["delayed", "realtime", "stale", "unknown"]);
    expect(
      marketData.quotes.some((quote) =>
        quote.freshness.warnings.some(
          (warning) => warning.severity === "blocking",
        ),
      ),
    ).toBe(true);
  });

  it("defines the BTC/NVDA acceptance run", () => {
    expect(acceptanceResearchRun.userRequest).toBe(
      "BTC and NVDA exposure together looks risky. Review my portfolio and suggest what to inspect.",
    );
    expect(acceptanceResearchRun.recommendationCategory).toBe("risk_warning");
    expect(
      acceptanceResearchRun.runCard.supportingEvidence.map(
        (item) => item.label,
      ),
    ).toContain("BTC/NVDA concentration");
  });

  it("contains connected, stale, and revoked remote device states", () => {
    expect(remoteDevices.map((device) => device.session.status).sort()).toEqual(
      ["connected", "revoked", "stale"],
    );
  });
});

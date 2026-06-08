import { describe, expect, it } from "vitest";

import { parsePositionEntryForm } from "./portfolio-position-entry";

describe("portfolio position entry", () => {
  it("builds a normalized add-position payload from valid form values", () => {
    const parsed = parsePositionEntryForm({
      averageCost: "65000.50",
      costCurrency: "usd",
      portfolioId: "portfolio-core",
      profileId: "profile-core",
      quantity: "0.75",
      symbol: " btc-usd ",
      thesis: " Hold as the crypto beta sleeve. ",
    });

    expect(parsed).toEqual({
      ok: true,
      input: {
        averageCost: 65000.5,
        costCurrency: "USD",
        portfolioId: "portfolio-core",
        profileId: "profile-core",
        quantity: 0.75,
        symbol: "BTC-USD",
        thesis: "Hold as the crypto beta sleeve.",
      },
    });
  });

  it("submits displayed crypto aliases as canonical command symbols", () => {
    const parsed = parsePositionEntryForm({
      averageCost: "65000",
      costCurrency: "usd",
      portfolioId: "portfolio-core",
      profileId: "profile-core",
      quantity: "0.25",
      symbol: " btc ",
      thesis: "",
    });

    expect(parsed).toEqual({
      ok: true,
      input: {
        averageCost: 65000,
        costCurrency: "USD",
        portfolioId: "portfolio-core",
        profileId: "profile-core",
        quantity: 0.25,
        symbol: "BTC-USD",
      },
    });
  });

  it("rejects malformed position values before they reach the command bridge", () => {
    expect(
      parsePositionEntryForm({
        averageCost: "10",
        costCurrency: "USD",
        portfolioId: "portfolio-core",
        profileId: "profile-core",
        quantity: "1",
        symbol: "",
        thesis: "",
      }),
    ).toEqual({ ok: false, messageKey: "portfolio.positionSymbolRequired" });

    expect(
      parsePositionEntryForm({
        averageCost: "-1",
        costCurrency: "USD",
        portfolioId: "portfolio-core",
        profileId: "profile-core",
        quantity: "0",
        symbol: "AAPL",
        thesis: "",
      }),
    ).toEqual({ ok: false, messageKey: "portfolio.positionQuantityRequired" });

    expect(
      parsePositionEntryForm({
        averageCost: "-1",
        costCurrency: "USD",
        portfolioId: "portfolio-core",
        profileId: "profile-core",
        quantity: "1",
        symbol: "AAPL",
        thesis: "",
      }),
    ).toEqual({
      ok: false,
      messageKey: "portfolio.positionAverageCostRequired",
    });

    expect(
      parsePositionEntryForm({
        averageCost: " ",
        costCurrency: "USD",
        portfolioId: "portfolio-core",
        profileId: "profile-core",
        quantity: "1",
        symbol: "AAPL",
        thesis: "",
      }),
    ).toEqual({
      ok: false,
      messageKey: "portfolio.positionAverageCostRequired",
    });

    expect(
      parsePositionEntryForm({
        averageCost: "10",
        costCurrency: "US",
        portfolioId: "portfolio-core",
        profileId: "profile-core",
        quantity: "1",
        symbol: "AAPL",
        thesis: "",
      }),
    ).toEqual({ ok: false, messageKey: "portfolio.positionCurrencyRequired" });

    expect(
      parsePositionEntryForm({
        averageCost: "10000",
        costCurrency: "KRW",
        portfolioId: "portfolio-core",
        profileId: "profile-core",
        quantity: "1",
        symbol: "AAPL",
        thesis: "",
      }),
    ).toEqual({ ok: false, messageKey: "portfolio.positionCurrencyRequired" });
  });
});

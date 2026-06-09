import { beforeEach, describe, expect, it } from "vitest";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  PAST_PERFORMANCE_CAVEAT,
  btcMovingAverageSpec,
  createMovingAverageCrossoverStrategy,
} from "@plutus/backtest";
import { fixtureIds } from "@plutus/test-fixtures";
import { LocalToolRouter, createInMemoryToolRuntime } from "./index";
import { makeRunContext } from "./test-support";

describe("local tool router", () => {
  beforeEach(() => {
    process.env.PLUTUS_ALLOW_FIXTURE_TOOLS = "1";
  });

  it("supports active-profile portfolio variants, grouped allocations, and filtered position history", async () => {
    const router = new LocalToolRouter();
    const context = makeRunContext("portfolio_manager");

    const portfolios = await router.call(context, {
      namespace: "plutus_portfolio",
      tool: "list_portfolios",
      input: { profileId: context.profileId },
    });
    expect(
      (portfolios.data as { portfolios: Array<{ profileId: string }> })
        .portfolios,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: fixtureIds.corePortfolio,
          profileId: context.profileId,
        }),
        expect.objectContaining({
          name: "Crypto Sleeve",
          profileId: context.profileId,
        }),
      ]),
    );

    const bySector = await router.call(context, {
      namespace: "plutus_portfolio",
      tool: "compute_allocation",
      input: { portfolioId: fixtureIds.corePortfolio, groupBy: "sector" },
    });
    expect(
      (bySector.data as { allocation: Array<{ groupKey: string }> }).allocation,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ groupBy: "sector", groupKey: "Technology" }),
        expect.objectContaining({
          groupBy: "sector",
          groupKey: "Unclassified",
        }),
      ]),
    );

    const byTag = await router.call(context, {
      namespace: "plutus_portfolio",
      tool: "compute_allocation",
      input: { portfolioId: fixtureIds.corePortfolio, groupBy: "tag" },
    });
    expect(
      (byTag.data as { allocation: Array<{ groupKey: string }> }).allocation,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          groupBy: "tag",
          groupKey: "concentration-review",
        }),
      ]),
    );

    const positionHistory = await router.call(context, {
      namespace: "plutus_portfolio",
      tool: "get_position_history",
      input: { instrumentId: fixtureIds.NVDA },
    });
    expect(
      (positionHistory.data as { events: Array<{ symbol: string }> }).events,
    ).toEqual([expect.objectContaining({ symbol: "NVDA" })]);

    const foreignProfile = await router.call(context, {
      namespace: "plutus_portfolio",
      tool: "list_portfolios",
      input: { profileId: "018f3f5d-0000-7000-8000-999999999999" },
    });
    expect(foreignProfile.ok).toBe(false);
    expect(foreignProfile.warnings[0]?.code).toBe("cross_profile_rejected");

    const foreignPortfolio = await router.call(context, {
      namespace: "plutus_portfolio",
      tool: "get_portfolio_snapshot",
      input: { portfolioId: "018f3f5d-0000-7000-8000-999999999998" },
    });
    expect(foreignPortfolio.ok).toBe(false);
    expect(foreignPortfolio.warnings[0]).toMatchObject({
      code: "cross_profile_denied",
      severity: "blocking",
    });
  });
});

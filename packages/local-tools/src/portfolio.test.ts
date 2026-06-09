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

  it("returns deterministic portfolio snapshots, performance, watchlists, and notes", async () => {
    const router = new LocalToolRouter();
    const context = makeRunContext("portfolio_manager");

    const snapshot = await router.call(context, {
      namespace: "plutus_portfolio",
      tool: "get_portfolio_snapshot",
      input: { portfolioId: fixtureIds.corePortfolio },
    });
    expect(snapshot.ok).toBe(true);
    expect(
      (snapshot.data as { portfolio: { id: string }; positions: unknown[] })
        .portfolio.id,
    ).toBe(fixtureIds.corePortfolio);
    expect(
      (snapshot.data as { portfolio: unknown; positions: unknown[] }).positions,
    ).toHaveLength(6);

    const performance = await router.call(context, {
      namespace: "plutus_portfolio",
      tool: "compute_performance",
      input: {
        portfolioId: fixtureIds.corePortfolio,
        start: "2026-01-01",
        end: "2026-05-17",
        benchmarkId: fixtureIds.SPY,
      },
    });
    expect(performance.ok).toBe(true);
    expect(
      (performance.data as { performance: { totalReturnPct: number } })
        .performance.totalReturnPct,
    ).toBeGreaterThan(0);

    const watchlists = await router.call(context, {
      namespace: "plutus_portfolio",
      tool: "get_watchlists",
      input: {},
    });
    expect(
      (watchlists.data as { watchlists: Array<{ items: unknown[] }> })
        .watchlists[0]?.items,
    ).toEqual(
      expect.arrayContaining([expect.objectContaining({ symbol: "QQQ" })]),
    );

    const notes = await router.call(context, {
      namespace: "plutus_portfolio",
      tool: "get_instrument_notes",
      input: { symbol: "NVDA" },
    });
    expect(
      (notes.data as { notes: Array<{ text: string }> }).notes[0]?.text,
    ).toContain("AI infrastructure");
  });

  it("reads exported app portfolio state without fixture-only position fields", async () => {
    const previousFixtureFlag = process.env.PLUTUS_ALLOW_FIXTURE_TOOLS;
    delete process.env.PLUTUS_ALLOW_FIXTURE_TOOLS;
    try {
      const router = new LocalToolRouter();
      const appDataPath = mkdtempSync(join(tmpdir(), "plutus-local-tools-"));
      mkdirSync(join(appDataPath, "local-tools"), { recursive: true });
      writeFileSync(
        join(appDataPath, "local-tools", "portfolio-state.json"),
        JSON.stringify({
          profileId: "018f3f5d-0000-7000-8000-000000000001",
          portfolios: [
            {
              id: "portfolio-live",
              profileId: "018f3f5d-0000-7000-8000-000000000001",
              name: "Live",
              baseCurrency: "USD",
              positions: [
                {
                  id: "position-live",
                  portfolioId: "portfolio-live",
                  symbol: "NVDA",
                  quantity: 2,
                  averageCost: 100,
                  thesis: "Live thesis",
                },
              ],
            },
          ],
        }),
        "utf8",
      );

      const response = await router.call(
        { ...makeRunContext("portfolio_manager"), appDataPath },
        {
          namespace: "plutus_portfolio",
          tool: "compute_allocation",
          input: { portfolioId: "portfolio-live", groupBy: "tag" },
        },
      );

      expect(response.ok).toBe(true);
      expect(
        (response.data as { allocation: Array<{ groupKey: string }> })
          .allocation,
      ).toEqual([expect.objectContaining({ groupKey: "untagged" })]);
    } finally {
      if (previousFixtureFlag === undefined) {
        delete process.env.PLUTUS_ALLOW_FIXTURE_TOOLS;
      } else {
        process.env.PLUTUS_ALLOW_FIXTURE_TOOLS = previousFixtureFlag;
      }
    }
  });

  it("reports provider setup warnings instead of throwing when live market data is unavailable", async () => {
    const previousFixtureFlag = process.env.PLUTUS_ALLOW_FIXTURE_TOOLS;
    const previousFetch = globalThis.fetch;
    delete process.env.PLUTUS_ALLOW_FIXTURE_TOOLS;
    globalThis.fetch = (async () => {
      throw new Error("network disabled in test");
    }) as typeof fetch;
    try {
      const router = new LocalToolRouter();
      const response = await router.call(makeRunContext("equity_analyst"), {
        namespace: "plutus_market_data",
        tool: "get_quote",
        input: {
          symbol: "NVDA",
          providerPreference: ["yahoo-compatible"],
        },
      });

      expect(response.ok).toBe(true);
      expect(response.warnings[0]?.code).toBe(
        "market_data_provider_unavailable",
      );
    } finally {
      globalThis.fetch = previousFetch;
      if (previousFixtureFlag === undefined) {
        delete process.env.PLUTUS_ALLOW_FIXTURE_TOOLS;
      } else {
        process.env.PLUTUS_ALLOW_FIXTURE_TOOLS = previousFixtureFlag;
      }
    }
  });
});

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

  it("serves deterministic quote fixtures without live network calls when fixture tools are explicit", async () => {
    const previousFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      throw new Error("fixture mode must not hit network");
    }) as typeof fetch;
    try {
      const router = new LocalToolRouter();
      const response = await router.call(makeRunContext("equity_analyst"), {
        namespace: "plutus_market_data",
        tool: "get_quote",
        input: {
          symbol: "BTC",
          providerPreference: ["coingecko"],
        },
      });

      expect(response.ok).toBe(true);
      expect(response.warnings).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: "market_data_provider_unavailable",
          }),
        ]),
      );
      expect((response.data as { quote: { provider: string } }).quote).toEqual(
        expect.objectContaining({ provider: "coingecko", price: 67120 }),
      );
    } finally {
      globalThis.fetch = previousFetch;
    }
  });

  it("does not fall back to another profile portfolio when portfolio id is omitted", async () => {
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
              id: "portfolio-other",
              profileId: "profile-other",
              name: "Other",
              baseCurrency: "USD",
              positions: [],
            },
          ],
          watchlists: [
            {
              id: "watchlist-other",
              profileId: "profile-other",
              name: "Other Watchlist",
              items: [{ id: "watch-other", symbol: "NVDA" }],
            },
          ],
        }),
        "utf8",
      );

      const response = await router.call(
        { ...makeRunContext("portfolio_manager"), appDataPath },
        {
          namespace: "plutus_portfolio",
          tool: "get_portfolio_snapshot",
          input: {},
        },
      );

      expect(response.ok).toBe(true);
      expect(response.warnings[0]?.code).toBe("portfolio_state_unavailable");
      const watchlists = await router.call(
        { ...makeRunContext("portfolio_manager"), appDataPath },
        {
          namespace: "plutus_portfolio",
          tool: "get_watchlists",
          input: {},
        },
      );
      expect(
        (watchlists.data as { watchlists: Array<{ id: string }> }).watchlists,
      ).toEqual([]);
    } finally {
      if (previousFixtureFlag === undefined) {
        delete process.env.PLUTUS_ALLOW_FIXTURE_TOOLS;
      } else {
        process.env.PLUTUS_ALLOW_FIXTURE_TOOLS = previousFixtureFlag;
      }
    }
  });
});

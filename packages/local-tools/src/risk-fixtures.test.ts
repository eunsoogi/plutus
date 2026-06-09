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

  it("serves deterministic fixture-backed risk analytics instead of generic risk stubs", async () => {
    const router = new LocalToolRouter();
    const context = makeRunContext("risk_manager");

    const correlation = await router.call(context, {
      namespace: "plutus_risk",
      tool: "compute_correlation",
      input: {
        instrumentIds: [fixtureIds.BTC, fixtureIds.NVDA],
        start: "2026-01-01",
        end: "2026-05-17",
        interval: "1d",
      },
    });
    expect(correlation.data).not.toMatchObject({
      tool: "compute_correlation",
      status: "computed",
    });
    expect(correlation.sourceRefs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "risk_fixture_return_series" }),
      ]),
    );
    expect(
      (
        correlation.data as {
          matrix: Array<{ pair: [string, string]; correlation: number }>;
        }
      ).matrix,
    ).toEqual([
      expect.objectContaining({
        pair: ["BTC", "NVDA"],
        correlation: 0.68,
      }),
    ]);

    const volatility = await router.call(context, {
      namespace: "plutus_risk",
      tool: "compute_volatility",
      input: { instrumentIdOrPortfolioId: fixtureIds.BTC },
    });
    expect(
      (volatility.data as { volatility: { realizedVolatilityPct: number } })
        .volatility.realizedVolatilityPct,
    ).toBe(58.4);

    const drawdown = await router.call(context, {
      namespace: "plutus_risk",
      tool: "compute_drawdown",
      input: { seriesRef: "fixture:portfolio-core" },
    });
    expect(
      (drawdown.data as { drawdown: { maxDrawdownPct: number } }).drawdown
        .maxDrawdownPct,
    ).toBe(-18.7);

    const concentration = await router.call(context, {
      namespace: "plutus_risk",
      tool: "check_concentration",
      input: {
        portfolioId: fixtureIds.corePortfolio,
        limits: { maxSingleAssetWeightPct: 25, maxCryptoWeightPct: 20 },
      },
    });
    expect(
      (concentration.data as { breaches: Array<{ symbol?: string }> }).breaches,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ symbol: "BTC" }),
        expect.objectContaining({ group: "crypto" }),
      ]),
    );

    const liquidity = await router.call(context, {
      namespace: "plutus_risk",
      tool: "check_liquidity",
      input: {
        instrumentIds: [fixtureIds.BTC, fixtureIds.NVDA],
        orderSizeAssumptions: { BTC: 1_000_000, NVDA: 5_000_000 },
      },
    });
    expect(
      (liquidity.data as { liquidity: Array<{ symbol: string }> }).liquidity,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ symbol: "BTC", estimatedSlippageBps: 34 }),
        expect.objectContaining({ symbol: "NVDA", estimatedSlippageBps: 12 }),
      ]),
    );
    expect(liquidity.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "liquidity_sizing_warning",
          evidenceRefs: ["risk_fixture_liquidity:BTC"],
        }),
      ]),
    );

    const scenario = await router.call(context, {
      namespace: "plutus_risk",
      tool: "run_scenario",
      input: {
        portfolioId: fixtureIds.corePortfolio,
        scenario: "liquidity_crunch",
      },
    });
    expect(
      (scenario.data as { scenario: { portfolioImpactPct: number } }).scenario
        .portfolioImpactPct,
    ).toBe(-13.9);
    expect(scenario.warnings.map((item) => item.code)).toContain(
      "scenario_loss_warning",
    );
  });
});

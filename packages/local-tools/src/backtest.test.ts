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

  it("persists backtest strategy, result, artifacts, reruns, and date range variants", async () => {
    const storageRoot = mkdtempSync(join(tmpdir(), "plutus-backtest-"));
    const runtime = Object.assign(createInMemoryToolRuntime(), { storageRoot });
    const router = new LocalToolRouter(runtime);
    const context = makeRunContext("quant_strategy_researcher");
    const firstSpec = btcMovingAverageSpec();
    const secondSpec = createMovingAverageCrossoverStrategy({
      primaryInstrumentId: fixtureIds.BTC,
      benchmarkId: fixtureIds.SPY,
      shortWindow: 20,
      longWindow: 50,
      start: "2021-02-01",
      end: "2021-06-30",
    });

    const invalidRegistered = await router.call(context, {
      namespace: "plutus_backtest",
      tool: "register_strategy_spec",
      input: { strategySpec: { universe: ["BTC"], longOnly: true } },
    });
    expect(invalidRegistered.data).toMatchObject({
      validation: expect.objectContaining({ valid: false }),
    });
    expect(invalidRegistered.warnings[0]).toMatchObject({
      severity: "blocking",
    });

    const registered = await router.call(context, {
      namespace: "plutus_backtest",
      tool: "register_strategy_spec",
      input: { strategySpec: firstSpec },
    });
    const strategySpecId = (registered.data as { strategySpecId: string })
      .strategySpecId;
    expect(strategySpecId).toMatch(/^strategy_/);

    const missingSpec = await router.call(context, {
      namespace: "plutus_backtest",
      tool: "run_backtest",
      input: {},
    });
    expect(missingSpec.data).toMatchObject({
      status: "rejected",
      validation: expect.objectContaining({ valid: false }),
    });
    expect(missingSpec.warnings[0]).toMatchObject({ severity: "blocking" });

    const first = await router.call(context, {
      namespace: "plutus_backtest",
      tool: "run_backtest",
      input: { strategySpecId },
    });
    const firstData = first.data as {
      backtestRunId: string;
      artifactRefs: string[];
      dateRange: { start: string; end: string };
    };
    expect(firstData.artifactRefs[0]).toMatch(/^artifact_/);
    expect(firstData.dateRange).toEqual(firstSpec.timeRange);
    expect(
      readFileSync(
        join(storageRoot, "backtests", `${firstData.backtestRunId}.json`),
        "utf8",
      ),
    ).toContain(firstSpec.name);

    const rerun = await router.call(context, {
      namespace: "plutus_backtest",
      tool: "run_backtest",
      input: { strategySpec: firstSpec, rerunOf: firstData.backtestRunId },
    });
    expect((rerun.data as { rerunOf: string }).rerunOf).toBe(
      firstData.backtestRunId,
    );
    expect((rerun.data as { backtestRunId: string }).backtestRunId).not.toBe(
      firstData.backtestRunId,
    );

    const variant = await router.call(context, {
      namespace: "plutus_backtest",
      tool: "run_backtest",
      input: { strategySpec: secondSpec, rerunOf: firstData.backtestRunId },
    });
    expect(
      (variant.data as { dateRange: { start: string } }).dateRange.start,
    ).toBe("2021-02-01");

    const stored = await router.call(context, {
      namespace: "plutus_backtest",
      tool: "get_backtest_result",
      input: { backtestRunId: firstData.backtestRunId },
    });
    expect(
      (
        stored.data as {
          record: { strategySpec: unknown; artifacts: unknown[] };
        }
      ).record,
    ).toMatchObject({
      strategySpec: expect.objectContaining({ name: firstSpec.name }),
      artifacts: [
        expect.objectContaining({
          mimeType: "text/markdown",
          contentHash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
        }),
      ],
    });
  });
});

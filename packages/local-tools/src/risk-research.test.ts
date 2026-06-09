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

  it("renders report and chart artifacts with hash, MIME type, source refs, and caveats", async () => {
    const router = new LocalToolRouter();
    const context = makeRunContext("report_writer");
    const report = await router.call(context, {
      namespace: "plutus_reports",
      tool: "render_report",
      input: {
        format: "markdown",
        sections: [
          { title: "Summary", body: "BTC/NVDA review." },
          { title: "Risk", body: "Concentration risk remains visible." },
        ],
        sourceRefs: [{ id: fixtureIds.acceptanceRun, provider: "fixture" }],
      },
    });

    expect(report.ok).toBe(true);
    const artifact = (report.data as { artifact: Record<string, unknown> })
      .artifact;
    expect(artifact).toMatchObject({
      mimeType: "text/markdown",
      sourceRefs: [expect.objectContaining({ id: fixtureIds.acceptanceRun })],
    });
    expect(artifact.contentHash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(artifact.content).toContain(PAST_PERFORMANCE_CAVEAT);

    const chart = await router.call(context, {
      namespace: "plutus_reports",
      tool: "create_chart_artifact",
      input: {
        chartSpec: {
          type: "line",
          title: "Equity Curve",
          series: [{ name: "portfolio", points: [{ x: "2026-05-17", y: 1 }] }],
        },
        sourceRefs: [{ id: "chart-source", provider: "fixture" }],
      },
    });
    expect(
      (chart.data as { artifact: { mimeType: string; contentHash: string } })
        .artifact,
    ).toMatchObject({
      mimeType: "application/vnd.plutus.chart+json",
      contentHash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
    });
  });

  it("durably records risk vetoes outside process memory", async () => {
    const storageRoot = mkdtempSync(join(tmpdir(), "plutus-risk-"));
    const runtime = Object.assign(createInMemoryToolRuntime(), { storageRoot });
    const router = new LocalToolRouter(runtime);
    const context = makeRunContext("risk_manager");

    const veto = await router.call(context, {
      namespace: "plutus_risk",
      tool: "register_risk_veto",
      input: { reason: "Max drawdown exceeded." },
    });

    const data = veto.data as { path: string; reason: string };
    expect(data.reason).toBe("Max drawdown exceeded.");
    expect(existsSync(data.path)).toBe(true);
    expect(readFileSync(data.path, "utf8")).toContain("Max drawdown exceeded.");
  });
});

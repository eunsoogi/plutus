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

  it("writes report artifacts to the runtime app-data path and automates memory then wiki capture for run cards", async () => {
    const storageRoot = mkdtempSync(join(tmpdir(), "plutus-local-tools-"));
    const runtime = Object.assign(createInMemoryToolRuntime(), { storageRoot });
    const router = new LocalToolRouter(runtime);
    const reportContext = makeRunContext("report_writer");

    const report = await router.call(reportContext, {
      namespace: "plutus_reports",
      tool: "render_report",
      input: {
        sections: [{ title: "Summary", body: "BTC/NVDA review." }],
        sourceRefs: [{ id: fixtureIds.acceptanceRun, provider: "fixture" }],
      },
    });
    const artifact = (report.data as { artifact: { path: string } }).artifact;
    expect(artifact.path).toContain(storageRoot);
    expect(readFileSync(artifact.path, "utf8")).toContain("BTC/NVDA review.");

    const runCard = await router.call(reportContext, {
      namespace: "plutus_reports",
      tool: "create_run_card",
      input: {
        payload: {
          category: "risk_warning",
          title: "BTC/NVDA run card",
          findings: ["BTC and NVDA concentration needs review."],
          summary: "Concentration remains visible.",
        },
      },
    });
    const automation = (
      runCard.data as {
        automation: {
          memoryCapture: { captured: unknown[] };
          wikiCuration: { pages: Array<{ id: string; profileId: string }> };
          memoryPath: string;
          wikiPath: string;
        };
      }
    ).automation;
    expect(automation.memoryCapture.captured.length).toBeGreaterThan(0);
    expect(automation.wikiCuration.pages[0]?.id).toBeTruthy();
    expect(automation.wikiCuration.pages[0]?.profileId).toBe(
      reportContext.profileId,
    );
    expect(existsSync(automation.memoryPath)).toBe(true);
    expect(automation.wikiPath).toContain(storageRoot);

    const recalled = await router.call(makeRunContext("llm_wiki_curator"), {
      namespace: "plutus_memory",
      tool: "recall_prior_runs",
      input: { query: "concentration", limit: 5 },
    });
    expect(
      (recalled.data as { memories: Array<{ summary: string }> }).memories,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          summary: expect.stringContaining("concentration"),
        }),
      ]),
    );
  });
});

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

  it("wires memory tools to the memory package instead of generic handlers", async () => {
    const storageRoot = mkdtempSync(join(tmpdir(), "plutus-memory-"));
    const router = new LocalToolRouter(
      Object.assign(createInMemoryToolRuntime(), { storageRoot }),
    );
    const context = makeRunContext("llm_wiki_curator");

    const captured = await router.call(context, {
      namespace: "plutus_memory",
      tool: "capture_research_memory",
      input: {
        summary: "BTC crossover thesis should track drawdown first.",
        semanticText: "BTC crossover thesis should track drawdown first.",
        tags: ["btc", "crossover"],
        sourceRefs: [{ type: "run", id: context.runId }],
      },
    });
    expect(captured.ok).toBe(true);
    expect(captured.data).not.toMatchObject({
      tool: "capture_research_memory",
      status: "ok",
    });
    const memoryId = (captured.data as { memory: { id: string } }).memory.id;
    expect(memoryId).toMatch(/[0-9a-f-]{36}/);
    expect(existsSync(join(storageRoot, "memory", `${memoryId}.json`))).toBe(
      true,
    );

    const recalled = await router.call(context, {
      namespace: "plutus_memory",
      tool: "recall_prior_runs",
      input: { query: "BTC drawdown", limit: 3 },
    });
    expect(
      (recalled.data as { memories: Array<{ memoryId: string }> }).memories,
    ).toEqual([expect.objectContaining({ memoryId })]);

    const reloadedRouter = new LocalToolRouter(
      Object.assign(createInMemoryToolRuntime(), { storageRoot }),
    );
    const reloaded = await reloadedRouter.call(context, {
      namespace: "plutus_memory",
      tool: "recall_prior_runs",
      input: { query: "BTC drawdown", limit: 3 },
    });
    expect(
      (reloaded.data as { memories: Array<{ memoryId: string }> }).memories,
    ).toEqual([expect.objectContaining({ memoryId })]);
  });

  it("wires wiki tools to the wiki package with revision and revert behavior", async () => {
    const router = new LocalToolRouter();
    const context = makeRunContext("llm_wiki_curator");
    const sourceRefs = [{ type: "run", id: context.runId, title: "Run" }];

    const created = await router.call(context, {
      namespace: "plutus_wiki",
      tool: "create_wiki_page",
      input: {
        category: "strategy",
        title: "BTC Crossover",
        slug: "btc-crossover",
        summary: "BTC crossover strategy notes.",
        markdown:
          "BTC crossover notes. [source:018f3f5d-0000-7000-8000-000000000006]",
        tags: ["btc"],
        sourceRefs,
        revisionNote: "Create deterministic page.",
      },
    });
    expect(created.ok).toBe(true);
    expect(created.data).not.toMatchObject({
      tool: "create_wiki_page",
      status: "ok",
    });
    const pageId = (created.data as { page: { id: string } }).page.id;
    const firstRevisionId = (
      created.data as { revisions: Array<{ id: string }> }
    ).revisions[0]?.id;
    expect(firstRevisionId).toBeTruthy();

    await router.call(context, {
      namespace: "plutus_wiki",
      tool: "update_wiki_page",
      input: {
        pageId,
        markdown:
          "Updated BTC crossover notes. [source:018f3f5d-0000-7000-8000-000000000006]",
        summary: "Updated notes.",
        sourceRefs,
        revisionNote: "Update page.",
      },
    });

    const reverted = await router.call(context, {
      namespace: "plutus_wiki",
      tool: "revert_wiki_revision",
      input: { pageId, revisionId: firstRevisionId, reason: "test revert" },
    });
    expect((reverted.data as { markdown: string }).markdown).toContain(
      "BTC crossover notes.",
    );
    expect((reverted.data as { revisions: unknown[] }).revisions).toHaveLength(
      3,
    );
  });
});

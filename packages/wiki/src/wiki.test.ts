import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ContradictionChecker,
  WikiCuratorService,
  WikiRepository,
} from "./index";

const sourceRefs = [
  { type: "artifact", id: "artifact-1", title: "BTC report" },
];

describe("wiki markdown storage and revisions", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "plutus-wiki-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("creates and updates markdown pages with source-linked revisions", () => {
    const repo = new WikiRepository({ rootDir: dir });
    const page = repo.createPage({
      profileId: "profile-1",
      category: "strategy",
      title: "BTC Crossover",
      slug: "btc-crossover",
      markdown: "Initial thesis\n\n[source:artifact-1]",
      summary: "Initial",
      tags: ["btc"],
      sourceRefs,
      memoryRefs: ["memory-1"],
      revisionNote: "create from run",
      createdBy: "agent:llm_wiki_curator",
    });

    const updated = repo.updatePage(page.id, {
      markdown: "Updated thesis\n\n[source:artifact-1]",
      summary: "Updated",
      sourceRefs,
      revisionNote: "add backtest result",
      createdBy: "agent:llm_wiki_curator",
    });

    expect(updated.revisions).toHaveLength(2);
    expect(updated.page.currentRevisionId).toBe(updated.revisions[1]?.id);
    expect(readFileSync(join(dir, updated.page.storageKey), "utf8")).toContain(
      "Updated thesis",
    );
    expect(updated.revisions[1]?.sourceRefs).toEqual(sourceRefs);
    expect(repo.activity.at(-1)?.eventType).toBe("updated");
  });

  it("reverts through a new revision without rewriting history", () => {
    const repo = new WikiRepository({ rootDir: dir });
    const page = repo.createPage({
      profileId: "profile-1",
      category: "strategy",
      title: "BTC Crossover",
      slug: "btc-crossover",
      markdown: "Version one\n\n[source:artifact-1]",
      summary: "v1",
      tags: ["btc"],
      sourceRefs,
      memoryRefs: [],
      revisionNote: "create",
      createdBy: "agent:llm_wiki_curator",
    });
    const updated = repo.updatePage(page.id, {
      markdown: "Version two\n\n[source:artifact-1]",
      sourceRefs,
      revisionNote: "update",
      createdBy: "user",
    });

    const reverted = repo.revertRevision(
      page.id,
      page.currentRevisionId,
      "restore v1",
      "user",
    );

    expect(reverted.revisions).toHaveLength(3);
    expect(readFileSync(join(dir, reverted.page.storageKey), "utf8")).toContain(
      "Version one",
    );
    expect(updated.revisions[1]?.contentHash).not.toBe(
      reverted.revisions[2]?.contentHash,
    );
    expect(repo.activity.at(-1)?.eventType).toBe("reverted");
  });

  it("archives pages and searches active markdown metadata", () => {
    const repo = new WikiRepository({ rootDir: dir });
    const page = repo.createPage({
      profileId: "profile-1",
      category: "risk_lesson",
      title: "Drawdown Lesson",
      slug: "drawdown-lesson",
      markdown: "Drawdown source\n\n[source:artifact-1]",
      summary: "Drawdown",
      tags: ["risk"],
      sourceRefs,
      memoryRefs: [],
      revisionNote: "create",
      createdBy: "agent:llm_wiki_curator",
    });

    expect(repo.search("drawdown")).toHaveLength(1);
    repo.archivePage(page.id, "superseded", "user");
    expect(repo.search("drawdown")).toHaveLength(0);
    expect(repo.getPage(page.id)?.page.status).toBe("archived");
  });
});

describe("wiki curator and contradiction checks", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "plutus-wiki-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("applies automatic curator create and update plans and keeps full markdown out of memory pointers", () => {
    const repo = new WikiRepository({ rootDir: dir });
    const service = new WikiCuratorService(repo);

    const result = service.maintain({
      runId: "44444444-4444-4444-8444-444444444444",
      actions: [
        {
          type: "create",
          category: "strategy",
          title: "BTC Trend",
          slug: "btc-trend",
          markdown: "BTC trend note\n\n[source:artifact-1]",
          summary: "BTC trend",
          tags: ["btc"],
          sourceRefs,
          revisionNote: "create from run",
        },
      ],
    });

    expect(result.pages).toHaveLength(1);
    expect(result.memoryPointers[0]?.semanticText).not.toContain(
      "BTC trend note",
    );
    expect(result.memoryPointers[0]?.summary).toContain("Wiki page updated");
    expect(repo.activity.at(-1)?.sourceRefs).toEqual(sourceRefs);
  });

  it("flags conflicting claims against existing pages", () => {
    const repo = new WikiRepository({ rootDir: dir });
    repo.createPage({
      profileId: "profile-1",
      category: "thesis",
      title: "BTC Trend",
      slug: "btc-trend",
      markdown: "- claim: BTC trend is bullish\n\n[source:artifact-1]",
      summary: "BTC trend is bullish",
      tags: ["btc"],
      sourceRefs,
      memoryRefs: [],
      revisionNote: "create",
      createdBy: "agent:llm_wiki_curator",
    });

    const conflicts = new ContradictionChecker(repo).findContradictions([
      "BTC trend is not bullish",
      "ETH volatility is elevated",
    ]);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.claim).toBe("BTC trend is not bullish");
  });
});

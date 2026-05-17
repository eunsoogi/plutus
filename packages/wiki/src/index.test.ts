import { describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { WikiRepository, WikiStore } from "./index";

describe("wiki store", () => {
  it("creates source-linked revisions and reverts them", () => {
    const sourceRefs = [
      {
        id: "run-card",
        provider: "plutus",
        retrievedAt: "2026-05-17T00:00:00.000Z",
      },
    ];
    const store = new WikiStore();
    const page = store.create(
      "BTC/NVDA concentration lesson",
      "Initial body",
      sourceRefs,
    );
    store.update(page.id, "Updated body", sourceRefs, "new evidence");
    expect(store.search("concentration")).toHaveLength(1);
    const reverted = store.revert(
      page.id,
      page.revisions[0]!.id,
      "test revert",
    );
    expect(reverted.body).toBe("Initial body");
    expect(reverted.revisions.at(-1)?.note).toContain("revert");
  });

  it("persists repository index and markdown across repository instances", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "plutus-wiki-"));
    const sourceRefs = [{ type: "run", id: "run-1", title: "Run 1" }];
    const repo = new WikiRepository({ rootDir });
    const page = repo.createPage({
      profileId: "profile-1",
      category: "strategy",
      title: "BTC Crossover",
      slug: "btc-crossover",
      markdown: "BTC crossover notes. [source:run-1]",
      summary: "BTC crossover notes.",
      tags: ["btc"],
      sourceRefs,
      memoryRefs: [],
      revisionNote: "Initial import.",
      createdBy: "agent:llm_wiki_curator",
    });

    const reloaded = new WikiRepository({ rootDir });
    expect(reloaded.listPages()).toEqual([
      expect.objectContaining({ id: page.id, title: "BTC Crossover" }),
    ]);
    expect(reloaded.getPage(page.id)?.markdown).toContain(
      "BTC crossover notes.",
    );
    expect(reloaded.activity).toEqual([
      expect.objectContaining({ pageId: page.id, eventType: "created" }),
    ]);
  });
});

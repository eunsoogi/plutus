import { describe, expect, it } from "vitest";
import { WikiStore } from "./index";

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
});

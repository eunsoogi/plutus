import { describe, expect, it } from "vitest";
import { MemoryStore } from "./index";

describe("memory store", () => {
  it("captures safe memories, recalls them, and blocks secrets", () => {
    const store = new MemoryStore();
    expect(
      store.capture("User prefers risk warnings before rebalancing.")?.body,
    ).toContain("risk warnings");
    expect(store.capture("api_key should be stored")).toBeNull();
    expect(store.recall("risk").length).toBe(1);
  });

  it("supports category toggles, edit, archive, and forget", () => {
    const store = new MemoryStore();
    store.setCategoryEnabled("research_memory", false);
    expect(store.capture("disabled")).toBeNull();
    store.setCategoryEnabled("research_memory", true);
    const record = store.capture("BTC thesis")!;
    expect(
      store.update(record.id, { body: "BTC volatility thesis" }).body,
    ).toContain("volatility");
    store.archive(record.id);
    expect(store.recall("BTC")).toHaveLength(0);
    store.forget(record.id);
    expect(store.list()).toHaveLength(0);
  });
});

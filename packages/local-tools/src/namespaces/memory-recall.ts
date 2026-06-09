import type { MemoryStore, RecallService } from "@plutus/memory";
import { ok } from "./common";

interface MemoryRuntime {
  store: MemoryStore;
  recall: RecallService;
}

export async function recall(
  auditRef: string,
  memory: MemoryRuntime,
  inputValue: unknown,
  defaultQuery: string,
) {
  const input = inputValue as { query?: string; limit?: number };
  const query = input.query ?? defaultQuery;
  const limit = input.limit ?? 10;
  const mem0Memories = await memory.recall.recall({
    query,
    limit,
    actor: "agent:recall",
  });
  const directMemories = memory.store.recall(query).map((record) => ({
    memoryId: record.id,
    summary: record.summary,
    kind: record.kind,
    relevance: record.retentionClass === "pinned" ? 0.85 : 0.7,
    sourceRefs: record.sourceRefs,
    lastRecalledAt: record.lastRecalledAt,
    warnings:
      record.sensitivityClass === "portfolio_private"
        ? ["Portfolio-private memory: compact summary only."]
        : [],
  }));
  const byId = new Map(
    [...mem0Memories, ...directMemories]
      .sort((a, b) => b.relevance - a.relevance)
      .map((record) => [record.memoryId, record]),
  );
  return ok(auditRef, "plutus_memory", {
    memories: [...byId.values()].slice(0, limit),
  });
}

import type { MemoryKind, SourceRef } from "./schema";
import type { MemoryStore } from "./store";

export interface RecalledMemory {
  memoryId: string;
  summary: string;
  kind: MemoryKind;
  relevance: number;
  sourceRefs: SourceRef[];
  lastRecalledAt?: string;
  warnings: string[];
}

export class RecallService {
  constructor(private readonly store: MemoryStore) {}

  async recall(input: {
    query: string;
    limit?: number;
    actor?: string;
  }): Promise<RecalledMemory[]> {
    const results = await this.store.searchMem0(input.query, input.limit ?? 10);
    const recalled: RecalledMemory[] = [];
    for (const result of results) {
      const record = this.store.findByMem0Id(result.id);
      if (
        !record ||
        record.status !== "active" ||
        !this.store.categoryEnabled(record.kind)
      )
        continue;
      const pinBoost = record.retentionClass === "pinned" ? 0.35 : 0;
      const recencyBoost = record.lastRecalledAt ? 0.02 : 0.05;
      recalled.push({
        memoryId: record.id,
        summary: record.summary,
        kind: record.kind,
        relevance: Math.min(1, result.score + pinBoost + recencyBoost),
        sourceRefs: record.sourceRefs,
        lastRecalledAt: record.lastRecalledAt,
        warnings:
          record.sensitivityClass === "portfolio_private"
            ? ["Portfolio-private memory: compact summary only."]
            : [],
      });
    }
    const sorted = recalled
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, input.limit ?? 10);
    for (const memory of sorted) {
      this.store.markRecalled(
        memory.memoryId,
        input.actor ?? "agent:ground",
        memory.relevance,
      );
    }
    return sorted;
  }
}

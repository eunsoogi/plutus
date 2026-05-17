import {
  CapturePolicy,
  FakeMem0Adapter,
  type MemoryRecord,
  MemoryStore,
  RecallService,
  type MemoryKind,
} from "@plutus/memory";

import { existsSync, readdirSync, readFileSync } from "node:fs";

import type { NamespaceHandlerArgs } from "./common";
import type { InMemoryToolRuntime } from "../audit/in-memory-audit";
import type { LocalToolRunContext } from "../context";
import type { LocalToolResponse } from "../schemas/envelope";
import { ok, storagePath, warning, writeDurableJson } from "./common";

interface MemoryRuntime {
  store: MemoryStore;
  recall: RecallService;
}

export const handleMemory = async ({
  call,
  context,
  runtime,
  auditRef,
}: NamespaceHandlerArgs): Promise<LocalToolResponse> => {
  const memory = memoryRuntime(runtime, context);

  switch (call.tool) {
    case "capture_research_memory": {
      const input = call.input as {
        summary?: string;
        semanticText?: string;
        tags?: string[];
        sourceRefs?: Array<{
          type?: string;
          id?: string;
          title?: string;
          url?: string;
        }>;
        kind?: MemoryKind;
        sensitivityClass?:
          | "normal"
          | "portfolio_private"
          | "account_private"
          | "secret_blocked";
        retentionClass?: "default" | "pinned" | "temporary" | "archived";
      };
      const result = await memory.store.capture(
        {
          kind: input.kind ?? "research_memory",
          summary: input.summary ?? input.semanticText ?? "",
          semanticText: input.semanticText ?? input.summary ?? "",
          tags: input.tags ?? [],
          sourceRefs: (input.sourceRefs ?? []).map((ref) => ({
            type: ref.type ?? "run",
            id: ref.id ?? context.runId,
            title: ref.title,
            url: ref.url,
          })),
          sensitivityClass: input.sensitivityClass ?? "normal",
          retentionClass: input.retentionClass ?? "default",
        },
        {
          policy: new CapturePolicy(),
          actor: `agent:${context.agentName}`,
          runId: context.runId,
          auditRef,
        },
      );
      if (result.status !== "captured") {
        return ok(auditRef, "plutus_memory", { result }, [
          warning(
            `memory_${result.status}`,
            result.status === "blocked" ? "blocking" : "info",
            result.reason,
          ),
        ]);
      }
      const path = writeDurableJson(
        runtime,
        context,
        ["memory", `${result.record.id}.json`],
        result.record,
      );
      return ok(auditRef, "plutus_memory", {
        memory: { ...result.record, path },
      });
    }
    case "recall_user_preferences":
      return recall(auditRef, memory, call.input, "user preference");
    case "recall_prior_runs":
      return recall(auditRef, memory, call.input, "run");
    case "recall_saved_theses":
      return recall(auditRef, memory, call.input, "thesis");
    case "update_research_memory": {
      const input = call.input as {
        memoryId?: string;
        summary?: string;
        semanticText?: string;
        tags?: string[];
        retentionClass?: "default" | "pinned" | "temporary" | "archived";
        body?: string;
      };
      const memoryId = input.memoryId ?? "";
      const updated = memory.store.update(
        memoryId,
        {
          summary: input.summary,
          semanticText: input.semanticText,
          tags: input.tags,
          retentionClass: input.retentionClass,
          body: input.body,
        },
        `agent:${context.agentName}`,
      );
      const path = writeDurableJson(
        runtime,
        context,
        ["memory", `${updated.id}.json`],
        updated,
      );
      return ok(auditRef, "plutus_memory", {
        memory: { ...updated, path },
      });
    }
    case "archive_research_memory": {
      const input = call.input as { memoryId?: string; reason?: string };
      const archived = memory.store.archive(
        input.memoryId ?? "",
        input.reason,
        `agent:${context.agentName}`,
      );
      const path = writeDurableJson(
        runtime,
        context,
        ["memory", `${archived.id}.json`],
        archived,
      );
      return ok(auditRef, "plutus_memory", {
        memory: { ...archived, path },
      });
    }
    case "forget_research_memory": {
      const input = call.input as { memoryId?: string };
      const forgotten = await memory.store.forget(
        input.memoryId ?? "",
        `agent:${context.agentName}`,
      );
      const path = writeDurableJson(
        runtime,
        context,
        ["memory", `${forgotten.id}.json`],
        forgotten,
      );
      return ok(auditRef, "plutus_memory", {
        memory: { ...forgotten, path },
      });
    }
    default:
      return ok(auditRef, "plutus_memory", undefined, [
        warning(
          "unsupported_memory_tool",
          "blocking",
          `${call.tool} is not implemented by plutus_memory.`,
        ),
      ]);
  }
};

async function recall(
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

function memoryRuntime(
  runtime: InMemoryToolRuntime,
  context: LocalToolRunContext,
): MemoryRuntime {
  const key = `memory_runtime_${context.profileId}`;
  const existing = runtime.records.get(key);
  if (isMemoryRuntime(existing)) {
    return existing;
  }
  const store = new MemoryStore({
    adapter: new FakeMem0Adapter(),
    profileId: context.profileId,
  });
  store.importRecords(loadPersistedMemoryRecords(runtime, context));
  const created = { store, recall: new RecallService(store) };
  runtime.records.set(key, created);
  return created;
}

function loadPersistedMemoryRecords(
  runtime: InMemoryToolRuntime,
  context: LocalToolRunContext,
): MemoryRecord[] {
  const dir = storagePath(runtime, context, "memory");
  if (!existsSync(dir)) return [];
  const records: MemoryRecord[] = [];
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".json")) continue;
    try {
      const parsed = JSON.parse(readFileSync(`${dir}/${file}`, "utf8")) as {
        id?: unknown;
        profileId?: unknown;
        kind?: unknown;
        summary?: unknown;
        semanticText?: unknown;
        tags?: unknown;
        sourceRefs?: unknown;
        sensitivityClass?: unknown;
        retentionClass?: unknown;
        status?: unknown;
        body?: unknown;
        capturePolicy?: unknown;
        createdAt?: unknown;
        updatedAt?: unknown;
      };
      if (
        typeof parsed.id === "string" &&
        parsed.profileId === context.profileId &&
        typeof parsed.kind === "string" &&
        typeof parsed.summary === "string" &&
        typeof parsed.semanticText === "string" &&
        Array.isArray(parsed.tags) &&
        Array.isArray(parsed.sourceRefs) &&
        typeof parsed.sensitivityClass === "string" &&
        typeof parsed.retentionClass === "string" &&
        typeof parsed.status === "string" &&
        typeof parsed.body === "string" &&
        typeof parsed.capturePolicy === "string" &&
        typeof parsed.createdAt === "string" &&
        typeof parsed.updatedAt === "string"
      ) {
        records.push(parsed as MemoryRecord);
      }
    } catch {
      continue;
    }
  }
  return records;
}

function isMemoryRuntime(value: unknown): value is MemoryRuntime {
  return Boolean(
    value && typeof value === "object" && "store" in value && "recall" in value,
  );
}

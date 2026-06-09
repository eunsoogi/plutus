import { existsSync, readdirSync, readFileSync } from "node:fs";
import {
  FakeMem0Adapter,
  MemoryStore,
  RecallService,
  type MemoryRecord,
} from "@plutus/memory";
import type { InMemoryToolRuntime } from "../audit/in-memory-audit";
import type { LocalToolRunContext } from "../context";
import { storagePath } from "./common";

interface MemoryRuntime {
  store: MemoryStore;
  recall: RecallService;
}

export function memoryRuntime(
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

import { CapturePolicy, type MemoryKind } from "@plutus/memory";

import type { NamespaceHandlerArgs } from "./common";
import type { LocalToolResponse } from "../schemas/envelope";
import { ok, warning, writeDurableJson } from "./common";
import { recall } from "./memory-recall";
import { memoryRuntime } from "./memory-runtime";

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

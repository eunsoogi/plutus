import {
  FakeMem0Adapter,
  MemoryCaptureService,
  MemoryStore,
  RecallService,
} from "@plutus/memory";
import { WikiCuratorService, WikiRepository } from "@plutus/wiki";

import type { SourceRef } from "../schemas/envelope";
import type { NamespaceHandler } from "./common";
import { storagePath, writeDurableJson } from "./common";

export async function automateRunCardCapture(
  runtime: Parameters<NamespaceHandler>[0]["runtime"],
  context: Parameters<NamespaceHandler>[0]["context"],
  card: Record<string, unknown>,
  sourceRefs: SourceRef[],
) {
  const store = new MemoryStore({
    adapter: new FakeMem0Adapter(),
    profileId: context.profileId,
  });
  runtime.records.set(`memory_runtime_${context.profileId}`, {
    store,
    recall: new RecallService(store),
  });
  const memoryService = new MemoryCaptureService(store);
  const memoryCapture = await memoryService.captureCompletedRun({
    runId: context.runId,
    runCard: JSON.stringify(card, null, 2),
    findings: Array.isArray(card.findings)
      ? card.findings.map((finding) => String(finding))
      : [String(card.summary ?? card.title ?? "Completed Plutus run.")],
    sourceRefs: sourceRefs.map((ref) => ({
      type: "run",
      id: ref.id,
      title: ref.title,
      url: ref.url,
    })),
  });
  const wikiRoot = storagePath(runtime, context, "wiki", context.profileId);
  const wikiRepo = new WikiRepository({ rootDir: wikiRoot });
  const wikiService = new WikiCuratorService(wikiRepo);
  const wikiCuration = wikiService.maintain({
    runId: context.runId,
    profileId: context.profileId,
    actions: [
      {
        type: "create",
        category: "workflow",
        title: String(card.title ?? `Run ${context.runId}`),
        slug: `run-${context.runId}`,
        markdown: `${JSON.stringify(card, null, 2)}\n\n[source:${sourceRefs[0]?.id ?? context.runId}]`,
        summary: String(card.summary ?? "Completed Plutus run card."),
        tags: ["run-card"],
        sourceRefs: sourceRefs.map((ref) => ({
          type: "run",
          id: ref.id,
          title: ref.title,
          url: ref.url,
        })),
        revisionNote: "Post-run run card curation.",
      },
    ],
  });

  const memoryPath = writeDurableJson(
    runtime,
    context,
    ["memory", `run-card-${context.runId}.json`],
    memoryCapture,
  );
  runtime.records.set(`run_card_memory_${context.runId}`, memoryCapture);

  return { memoryCapture, wikiCuration, memoryPath, wikiPath: wikiRoot };
}

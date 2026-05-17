import type { NamespaceHandler } from "./common";
import {
  contentHash,
  ok,
  storagePath,
  warning,
  writeDurableJson,
  writeDurableText,
} from "./common";
import type { SourceRef } from "../schemas/envelope";
import {
  FakeMem0Adapter,
  MemoryCaptureService,
  RecallService,
  MemoryStore,
} from "@plutus/memory";
import { WikiCuratorService, WikiRepository } from "@plutus/wiki";

const PAST_PERFORMANCE_CAVEAT =
  "Past performance does not guarantee future results.";

export const handleReports: NamespaceHandler = async ({
  call,
  context,
  runtime,
  auditRef,
}) => {
  if (call.tool === "create_run_card") {
    const payload =
      (call.input as { payload?: Record<string, unknown> }).payload ?? {};
    const category = payload.category;
    if (category !== "risk_warning" && category !== "no_action") {
      return ok(auditRef, "plutus_reports", undefined, [
        warning(
          "unsafe_final_category",
          "blocking",
          "Final run cards must use an allowed safety category.",
        ),
      ]);
    }
    const card = {
      runId: context.runId,
      profileId: context.profileId,
      ...payload,
    };
    const cardPath = writeDurableJson(
      runtime,
      context,
      ["reports", `run-card-${context.runId}.json`],
      card,
    );
    const automation = await automateRunCardCapture(
      runtime,
      context,
      card,
      normalizeSourceRefs(
        (payload.sourceRefs as Partial<SourceRef>[] | undefined) ?? [],
      ),
    );
    runtime.records.set(`run_card_${context.runId}`, card);
    return ok(
      auditRef,
      "plutus_reports",
      { ...card, path: cardPath, automation },
      [
        warning(
          "risk_caveat_required",
          "info",
          "Risk caveats and assumptions must remain visible.",
        ),
      ],
    );
  }

  if (call.tool === "create_mobile_summary") {
    const summary = {
      runId: context.runId,
      profileId: context.profileId,
      ...(call.input as object),
    };
    runtime.records.set(`mobile_summary_${context.runId}`, summary);
    writeDurableJson(
      runtime,
      context,
      ["reports", `mobile-summary-${context.runId}.json`],
      summary,
    );
    return ok(auditRef, "plutus_reports", summary);
  }

  if (call.tool === "render_report") {
    const input = call.input as {
      format?: "markdown" | "html" | "pdf";
      sections?: Array<{ title: string; body: string }>;
      sourceRefs?: Partial<SourceRef>[];
    };
    const format = input.format ?? "markdown";
    const content = renderReportContent(input.sections ?? [], format);
    const artifact = artifactFor({
      runtime,
      context,
      runId: context.runId,
      kind: "report",
      content,
      mimeType:
        format === "html"
          ? "text/html"
          : format === "pdf"
            ? "application/pdf"
            : "text/markdown",
      sourceRefs: normalizeSourceRefs(input.sourceRefs),
    });
    runtime.records.set(artifact.id, artifact);
    runtime.records.set(`report_artifact_${context.runId}`, artifact);
    return ok(auditRef, "plutus_reports", { artifact }, [
      warning("past_performance", "warning", PAST_PERFORMANCE_CAVEAT, [
        artifact.id,
      ]),
    ]);
  }

  if (call.tool === "create_chart_artifact") {
    const input = call.input as {
      chartSpec?: unknown;
      sourceRefs?: Partial<SourceRef>[];
    };
    const content = JSON.stringify(
      {
        chartSpec: input.chartSpec ?? {},
        caveat: PAST_PERFORMANCE_CAVEAT,
      },
      null,
      2,
    );
    const artifact = artifactFor({
      runtime,
      context,
      runId: context.runId,
      kind: "chart",
      content,
      mimeType: "application/vnd.plutus.chart+json",
      sourceRefs: normalizeSourceRefs(input.sourceRefs),
    });
    runtime.records.set(artifact.id, artifact);
    return ok(auditRef, "plutus_reports", { artifact }, [
      warning("past_performance", "warning", PAST_PERFORMANCE_CAVEAT, [
        artifact.id,
      ]),
    ]);
  }

  if (call.tool === "register_artifact") {
    const input = call.input as {
      artifact?: Record<string, unknown>;
      sourceRefs?: Partial<SourceRef>[];
    };
    const content = JSON.stringify(input.artifact ?? {}, null, 2);
    const artifact = artifactFor({
      runtime,
      context,
      runId: context.runId,
      kind: "registered",
      content,
      mimeType: "application/json",
      sourceRefs: normalizeSourceRefs(input.sourceRefs),
    });
    runtime.records.set(artifact.id, artifact);
    return ok(auditRef, "plutus_reports", { artifact });
  }

  return ok(auditRef, "plutus_reports", undefined, [
    warning(
      "unsupported_report_tool",
      "blocking",
      `${call.tool} is not implemented by plutus_reports.`,
    ),
  ]);
};

function renderReportContent(
  sections: Array<{ title: string; body: string }>,
  format: "markdown" | "html" | "pdf",
) {
  const markdown = [
    "# Plutus Research Report",
    "",
    ...sections.flatMap((section) => [
      `## ${section.title}`,
      "",
      section.body,
      "",
    ]),
    "## Caveat",
    "",
    PAST_PERFORMANCE_CAVEAT,
    "",
  ].join("\n");
  if (format === "html") {
    return markdown
      .split("\n")
      .map((line) =>
        line.startsWith("# ")
          ? `<h1>${line.slice(2)}</h1>`
          : line.startsWith("## ")
            ? `<h2>${line.slice(3)}</h2>`
            : line
              ? `<p>${line}</p>`
              : "",
      )
      .join("\n");
  }
  return markdown;
}

function artifactFor(input: {
  runtime: Parameters<NamespaceHandler>[0]["runtime"];
  context: Parameters<NamespaceHandler>[0]["context"];
  runId: string;
  kind: string;
  content: string;
  mimeType: string;
  sourceRefs: SourceRef[];
}) {
  const hash = contentHash(input.content);
  const extension =
    input.mimeType === "text/markdown"
      ? "md"
      : input.mimeType === "text/html"
        ? "html"
        : input.mimeType === "application/json"
          ? "json"
          : "artifact";
  const id = `artifact_${input.kind}_${hash.slice(7, 19)}`;
  const path = writeDurableText(
    input.runtime,
    input.context,
    ["artifacts", `${id}.${extension}`],
    input.content,
  );
  return {
    id,
    runId: input.runId,
    kind: input.kind,
    content: input.content,
    contentHash: hash,
    path,
    mimeType: input.mimeType,
    sourceRefs: input.sourceRefs,
    caveats: [PAST_PERFORMANCE_CAVEAT],
    createdAt: new Date(0).toISOString(),
  };
}

async function automateRunCardCapture(
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

  return {
    memoryCapture,
    wikiCuration,
    memoryPath,
    wikiPath: wikiRoot,
  };
}

function normalizeSourceRefs(
  refs: Partial<SourceRef>[] | undefined,
): SourceRef[] {
  return (
    refs?.length ? refs : [{ id: "local-run", provider: "plutus_reports" }]
  ).map((ref) => ({
    id: ref.id ?? "local-run",
    provider: ref.provider ?? "plutus_reports",
    title: ref.title,
    url: ref.url,
    asOf: ref.asOf,
    retrievedAt: ref.retrievedAt ?? new Date(0).toISOString(),
  }));
}

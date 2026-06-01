import { PAST_PERFORMANCE_CAVEAT } from "@plutus/backtest";
import type { NamespaceHandler } from "./common";
import { ok, storagePath, warning, writeDurableJson } from "./common";
import type { SourceRef } from "../schemas/envelope";
import { artifactFor, normalizeSourceRefs, renderReportContent, reportLocaleValue, reportMimeType, type ReportFormat } from "./report-artifacts";
import {
  FakeMem0Adapter,
  MemoryCaptureService,
  RecallService,
  MemoryStore,
} from "@plutus/memory";
import { WikiCuratorService, WikiRepository } from "@plutus/wiki";

export const handleReports: NamespaceHandler = async ({
  call,
  context,
  runtime,
  auditRef,
}) => {
  if (call.tool === "create_run_card") {
    const input = call.input as {
      payload?: Record<string, unknown>;
      locale?: string;
      reportLocale?: string;
    };
    const payload = input.payload ?? {};
    const locale = reportLocaleValue(input.locale ?? input.reportLocale);
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
      locale,
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
    const input = call.input as {
      locale?: string;
      reportLocale?: string;
      payload?: Record<string, unknown>;
    };
    const payload = input.payload ?? call.input;
    const locale = reportLocaleValue(input.locale ?? input.reportLocale);
    const summary = {
      runId: context.runId,
      profileId: context.profileId,
      ...(payload as object),
      locale,
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
      format?: ReportFormat;
      locale?: string;
      reportLocale?: string;
      sections?: Array<{ title: string; body: string }>;
      sourceRefs?: Partial<SourceRef>[];
    };
    const format = input.format ?? "markdown";
    const locale = reportLocaleValue(input.locale ?? input.reportLocale);
    const content = renderReportContent({
      sections: input.sections ?? [],
      format,
      locale,
    });
    const artifact = artifactFor({
      runtime,
      context,
      runId: context.runId,
      kind: "report",
      content,
      mimeType: reportMimeType(format),
      sourceRefs: normalizeSourceRefs(input.sourceRefs),
      locale,
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

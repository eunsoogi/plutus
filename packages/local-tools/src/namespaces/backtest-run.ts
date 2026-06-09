import {
  PAST_PERFORMANCE_CAVEAT,
  renderBacktestMarkdownReport,
  runLongOnlyBacktest,
} from "@plutus/backtest";
import {
  contentHash,
  ok,
  warning,
  writeDurableJson,
  writeDurableText,
} from "./common";
import { nextBacktestSequence, resolveStrategySpec } from "./backtest-records";
import type { NamespaceHandlerArgs } from "./common";

export function runBacktest(args: NamespaceHandlerArgs) {
  const { call, context, runtime, auditRef } = args;
  const input = call.input as {
    strategySpec?: unknown;
    strategySpecId?: string;
    rerunOf?: string;
  };
  const resolved = resolveStrategySpec(runtime, input);
  if (!resolved.strategySpec) {
    const validation = resolved.validation;
    return ok(auditRef, "plutus_backtest", { status: "rejected", validation }, [
      warning(
        "invalid_strategy_spec",
        "blocking",
        validation.errors.join("; "),
      ),
    ]);
  }

  const strategySpec = resolved.strategySpec;
  const validation = resolved.validation;
  if (!validation.valid) {
    return ok(auditRef, "plutus_backtest", { status: "rejected", validation }, [
      warning(
        "invalid_strategy_spec",
        "blocking",
        validation.errors.join("; "),
      ),
    ]);
  }

  let result: ReturnType<typeof runLongOnlyBacktest>;
  try {
    result = runLongOnlyBacktest(strategySpec);
  } catch (error) {
    return ok(auditRef, "plutus_backtest", { status: "rejected" }, [
      warning(
        "backtest_run_failed",
        "blocking",
        error instanceof Error ? error.message : "Backtest run failed.",
      ),
    ]);
  }
  const sequence = nextBacktestSequence(runtime);
  const backtestRunId = `backtest_${context.runId}_${sequence}`;
  const reportContent = renderBacktestMarkdownReport(result);
  const artifactPath = writeDurableText(
    runtime,
    context,
    ["backtests", `${backtestRunId}.md`],
    reportContent,
  );
  const artifact = {
    id: `artifact_${backtestRunId}`,
    runId: context.runId,
    backtestRunId,
    kind: "backtest_report",
    mimeType: "text/markdown",
    content: reportContent,
    contentHash: contentHash(reportContent),
    path: artifactPath,
    sourceRefs: [
      {
        id: backtestRunId,
        provider: "plutus_backtest",
        retrievedAt: new Date(0).toISOString(),
      },
    ],
    caveats: [PAST_PERFORMANCE_CAVEAT],
    createdAt: new Date(0).toISOString(),
  };
  const record = {
    backtestRunId,
    rerunOf: input.rerunOf,
    instruments: strategySpec.assetUniverse.map((asset) => asset.instrumentId),
    strategySpec,
    status: "completed",
    profileId: context.profileId,
    result,
    dateRange: strategySpec.timeRange,
    artifacts: [artifact],
    createdAt: new Date(0).toISOString(),
  };
  const recordPath = writeDurableJson(
    runtime,
    context,
    ["backtests", `${backtestRunId}.json`],
    record,
  );
  runtime.records.set(backtestRunId, { ...record, path: recordPath });
  runtime.records.set(artifact.id, artifact);
  return ok(
    auditRef,
    "plutus_backtest",
    {
      backtestRunId,
      rerunOf: record.rerunOf,
      status: "completed",
      dateRange: record.dateRange,
      metrics: result?.metrics ?? {},
      artifactRefs: [artifact.id],
      path: recordPath,
    },
    [
      warning(
        "past_performance",
        "warning",
        "Past performance does not guarantee future results.",
      ),
      warning(
        "assumptions_recorded",
        "info",
        "Fees, slippage, and provider assumptions were stored.",
      ),
    ],
  );
}

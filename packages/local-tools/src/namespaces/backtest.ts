import type { NamespaceHandler } from "./common";
import {
  contentHash,
  ok,
  warning,
  writeDurableJson,
  writeDurableText,
} from "./common";
import {
  PAST_PERFORMANCE_CAVEAT,
  type BacktestResult,
  renderBacktestMarkdownReport,
  runLongOnlyBacktest,
  type StrategySpec,
  StrategySpecSchema,
  validateStrategySpec,
} from "@plutus/backtest";

export const handleBacktest: NamespaceHandler = ({
  call,
  context,
  runtime,
  auditRef,
}) => {
  if (call.tool === "run_backtest") {
    const input = call.input as {
      strategySpec?: unknown;
      strategySpecId?: string;
      rerunOf?: string;
    };
    const resolved = resolveStrategySpec(runtime, input);
    if (!resolved.strategySpec) {
      const validation = resolved.validation;
      return ok(
        auditRef,
        "plutus_backtest",
        { status: "rejected", validation },
        [
          warning(
            "invalid_strategy_spec",
            "blocking",
            validation.errors.join("; "),
          ),
        ],
      );
    }

    const strategySpec = resolved.strategySpec;
    const validation = resolved.validation;
    if (!validation.valid) {
      return ok(
        auditRef,
        "plutus_backtest",
        { status: "rejected", validation },
        [
          warning(
            "invalid_strategy_spec",
            "blocking",
            validation.errors.join("; "),
          ),
        ],
      );
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
      instruments: strategySpec.assetUniverse.map(
        (asset) => asset.instrumentId,
      ),
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

  if (call.tool === "validate_strategy_spec") {
    const input = call.input as { strategySpec?: unknown };
    const parsed = validateStrategyInput(input.strategySpec);
    return ok(
      auditRef,
      "plutus_backtest",
      parsed,
      parsed.valid
        ? []
        : [
            warning(
              "unsupported_strategy",
              "blocking",
              parsed.errors.join("; "),
            ),
          ],
    );
  }

  if (call.tool === "get_backtest_result") {
    const input = call.input as { backtestRunId?: string };
    const record = input.backtestRunId
      ? runtime.records.get(input.backtestRunId)
      : undefined;
    return ok(auditRef, "plutus_backtest", {
      backtestRunId: input.backtestRunId,
      record: record ?? null,
      result: backtestRecordResult(record) ?? record ?? null,
    });
  }

  if (call.tool === "compare_backtests") {
    const input = call.input as {
      backtestRunIds?: string[];
      benchmarkId?: string;
    };
    return ok(auditRef, "plutus_backtest", {
      benchmarkId: input.benchmarkId,
      comparisons: (input.backtestRunIds ?? []).map((backtestRunId) => ({
        backtestRunId,
        record: runtime.records.get(backtestRunId) ?? null,
        result:
          backtestRecordResult(runtime.records.get(backtestRunId)) ?? null,
      })),
    });
  }

  if (call.tool === "register_strategy_spec") {
    const input = call.input as { strategySpec?: unknown };
    const parsed = parseStrategySpec(input.strategySpec);
    const validation = parsed.validation;
    if (!validation.valid || !parsed.strategySpec) {
      return ok(
        auditRef,
        "plutus_backtest",
        { status: "rejected", validation },
        [
          warning(
            "invalid_strategy_spec",
            "blocking",
            validation.errors.join("; "),
          ),
        ],
      );
    }
    const strategySpecId = `strategy_${context.runId}_${nextStrategySequence(runtime)}`;
    const record = {
      strategySpecId,
      strategySpec: parsed.strategySpec,
      profileId: context.profileId,
      validation,
      createdAt: new Date(0).toISOString(),
    };
    const path = writeDurableJson(
      runtime,
      context,
      ["strategies", `${strategySpecId}.json`],
      record,
    );
    runtime.records.set(strategySpecId, { ...record, path });
    return ok(auditRef, "plutus_backtest", {
      strategySpecId,
      validation,
      path,
    });
  }

  if (call.tool === "get_strategy_spec") {
    const input = call.input as { strategySpecId?: string };
    return ok(auditRef, "plutus_backtest", {
      strategySpecId: input.strategySpecId,
      strategySpec: input.strategySpecId
        ? runtime.records.get(input.strategySpecId)
        : null,
    });
  }

  if (call.tool === "render_backtest_report") {
    const input = call.input as { backtestRunId?: string };
    const record = input.backtestRunId
      ? runtime.records.get(input.backtestRunId)
      : undefined;
    const result = backtestRecordResult(record);
    return ok(auditRef, "plutus_backtest", {
      markdown:
        result && "metrics" in result
          ? renderBacktestMarkdownReport(result)
          : "Backtest result is not available.",
    });
  }

  return ok(auditRef, "plutus_backtest", {
    tool: call.tool,
    status: "unsupported_backtest_tool",
  });
};

function nextBacktestSequence(runtime: {
  records: Map<string, unknown>;
}): number {
  const key = "backtest_sequence";
  const next = Number(runtime.records.get(key) ?? 0) + 1;
  runtime.records.set(key, next);
  return next;
}

function nextStrategySequence(runtime: {
  records: Map<string, unknown>;
}): number {
  const key = "strategy_sequence";
  const next = Number(runtime.records.get(key) ?? 0) + 1;
  runtime.records.set(key, next);
  return next;
}

function backtestRecordResult(record: unknown): BacktestResult | undefined {
  if (!record || typeof record !== "object" || !("result" in record)) {
    return undefined;
  }
  const result = (record as { result?: unknown }).result;
  return result && typeof result === "object"
    ? (result as BacktestResult)
    : undefined;
}

function validateStrategyInput(value: unknown) {
  return parseStrategySpec(value).validation;
}

function parseStrategySpec(value: unknown): {
  strategySpec?: StrategySpec;
  validation: { valid: boolean; errors: string[]; warnings: string[] };
} {
  const parsed = StrategySpecSchema.safeParse(value);
  if (!parsed.success) {
    return {
      validation: {
        valid: false,
        errors: [
          "strategySpec must match the Plutus StrategySpec schema.",
          ...parsed.error.issues.map(
            (issue) => `${issue.path.join(".")}: ${issue.message}`,
          ),
        ],
        warnings: [],
      },
    };
  }
  return {
    strategySpec: parsed.data,
    validation: validateStrategySpec(parsed.data),
  };
}

function resolveStrategySpec(
  runtime: { records: Map<string, unknown> },
  input: { strategySpec?: unknown; strategySpecId?: string },
): {
  strategySpec?: StrategySpec;
  validation: { valid: boolean; errors: string[]; warnings: string[] };
} {
  if (input.strategySpec) {
    return parseStrategySpec(input.strategySpec);
  }
  if (!input.strategySpecId) {
    return parseStrategySpec(undefined);
  }
  const record = runtime.records.get(input.strategySpecId);
  if (!record || typeof record !== "object" || !("strategySpec" in record)) {
    return {
      validation: {
        valid: false,
        errors: [`strategySpecId ${input.strategySpecId} was not found.`],
        warnings: [],
      },
    };
  }
  return parseStrategySpec((record as { strategySpec?: unknown }).strategySpec);
}

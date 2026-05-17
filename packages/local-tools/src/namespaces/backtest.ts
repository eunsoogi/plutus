import type { NamespaceHandler } from "./common";
import { ok, warning } from "./common";
import {
  type BacktestResult,
  renderBacktestMarkdownReport,
  runLongOnlyBacktest,
  type StrategySpec,
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
      strategySpec?: {
        universe?: string[];
        longOnly?: boolean;
        leverage?: number;
      };
    };
    const strategySpec = input.strategySpec ?? {};
    if (strategySpec.longOnly === false || (strategySpec.leverage ?? 1) > 1) {
      return ok(auditRef, "plutus_backtest", undefined, [
        warning(
          "unsupported_strategy",
          "blocking",
          "MVP backtests support long-only, unlevered strategies only.",
        ),
      ]);
    }
    const normalizedSpec = hasAssetUniverse(strategySpec)
      ? (strategySpec as StrategySpec)
      : undefined;
    const validation = normalizedSpec
      ? validateStrategySpec(normalizedSpec)
      : { valid: true, errors: [], warnings: [] };
    if (!validation.valid) {
      return ok(auditRef, "plutus_backtest", { validation }, [
        warning(
          "unsupported_strategy",
          "blocking",
          validation.errors.join("; "),
        ),
      ]);
    }
    const result = normalizedSpec ? runLongOnlyBacktest(normalizedSpec) : null;
    const backtestRunId = `backtest_${context.runId}`;
    runtime.records.set(backtestRunId, {
      backtestRunId,
      instruments: strategySpec.universe ?? [],
      status: "completed",
      profileId: context.profileId,
      result,
    });
    return ok(
      auditRef,
      "plutus_backtest",
      {
        backtestRunId,
        status: "completed",
        metrics: result?.metrics ?? {},
        artifactRefs: [`artifact_${backtestRunId}`],
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
    const parsed = hasAssetUniverse(input.strategySpec)
      ? validateStrategySpec(input.strategySpec as StrategySpec)
      : {
          valid: false,
          errors: ["strategySpec must match the Plutus StrategySpec schema."],
          warnings: [],
        };
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
        result: runtime.records.get(backtestRunId) ?? null,
      })),
    });
  }

  if (call.tool === "register_strategy_spec") {
    const input = call.input as { strategySpec?: unknown };
    const strategySpecId = `strategy_${context.runId}`;
    runtime.records.set(strategySpecId, {
      strategySpecId,
      strategySpec: input.strategySpec,
      profileId: context.profileId,
    });
    return ok(auditRef, "plutus_backtest", { strategySpecId });
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

function hasAssetUniverse(value: unknown): value is { assetUniverse: unknown } {
  return Boolean(
    value && typeof value === "object" && "assetUniverse" in value,
  );
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

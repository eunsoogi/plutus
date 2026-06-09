import type { NamespaceHandler } from "./common";
import { ok, warning, writeDurableJson } from "./common";
import { renderBacktestMarkdownReport } from "@plutus/backtest";
import { runBacktest } from "./backtest-run";
import {
  backtestRecordResult,
  nextStrategySequence,
  parseStrategySpec,
  validateStrategyInput,
} from "./backtest-records";

export const handleBacktest: NamespaceHandler = ({
  call,
  context,
  runtime,
  auditRef,
}) => {
  if (call.tool === "run_backtest") {
    return runBacktest({ call, context, runtime, auditRef });
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

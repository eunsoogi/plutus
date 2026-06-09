import type { BacktestResult, StrategySpec } from "@plutus/backtest";
import { StrategySpecSchema, validateStrategySpec } from "@plutus/backtest";

export function nextBacktestSequence(runtime: {
  records: Map<string, unknown>;
}): number {
  const key = "backtest_sequence";
  const next = Number(runtime.records.get(key) ?? 0) + 1;
  runtime.records.set(key, next);
  return next;
}

export function nextStrategySequence(runtime: {
  records: Map<string, unknown>;
}): number {
  const key = "strategy_sequence";
  const next = Number(runtime.records.get(key) ?? 0) + 1;
  runtime.records.set(key, next);
  return next;
}

export function backtestRecordResult(
  record: unknown,
): BacktestResult | undefined {
  if (!record || typeof record !== "object" || !("result" in record)) {
    return undefined;
  }
  const result = (record as { result?: unknown }).result;
  return result && typeof result === "object"
    ? (result as BacktestResult)
    : undefined;
}

export function validateStrategyInput(value: unknown) {
  return parseStrategySpec(value).validation;
}

export function parseStrategySpec(value: unknown): {
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

export function resolveStrategySpec(
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

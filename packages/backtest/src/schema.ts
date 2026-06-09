import { z } from "zod";
import type { BacktestValidationResult, StrategySpec } from "./types";

export const BACKTEST_PAST_PERFORMANCE_CAVEAT =
  "Past performance does not guarantee future results.";
export const PAST_PERFORMANCE_CAVEAT = BACKTEST_PAST_PERFORMANCE_CAVEAT;

const UuidSchema = z.string().uuid();
const SUPPORTED_FIXTURE_INSTRUMENT_IDS = new Set([
  "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "018f3f5d-0000-7000-8000-000000000103",
  "018f3f5d-0000-7000-8000-000000000107",
]);

export const StrategySpecSchema = z.object({
  id: UuidSchema.optional(),
  name: z.string().min(1),
  assetUniverse: z
    .array(
      z.object({
        instrumentId: UuidSchema,
        role: z.enum(["primary", "benchmark", "rotation_candidate"]),
      }),
    )
    .min(1),
  timeRange: z.object({
    start: z.string().date(),
    end: z.string().date(),
  }),
  entryRules: z.array(
    z.object({
      type: z.enum(["moving_average_cross", "threshold", "rebalance_schedule"]),
      params: z.record(z.string(), z.unknown()),
      description: z.string(),
    }),
  ),
  exitRules: z.array(
    z.object({
      type: z.enum([
        "moving_average_cross",
        "stop_loss",
        "time_exit",
        "rebalance_schedule",
      ]),
      params: z.record(z.string(), z.unknown()),
      description: z.string(),
    }),
  ),
  positionSizing: z.object({
    mode: z.enum([
      "full_notional",
      "fixed_weight",
      "equal_weight",
      "cash_buffer",
    ]),
    params: z.record(z.string(), z.unknown()),
  }),
  riskRules: z.array(
    z.object({
      type: z.enum([
        "max_position_weight",
        "max_drawdown_stop",
        "cash_minimum",
      ]),
      params: z.record(z.string(), z.unknown()),
      description: z.string(),
    }),
  ),
  requiredData: z.array(
    z.object({
      instrumentId: UuidSchema,
      interval: z.enum(["1d", "1wk", "1mo"]),
      fields: z.array(
        z.enum(["open", "high", "low", "close", "volume", "adjusted_close"]),
      ),
    }),
  ),
  benchmarkId: z.string(),
  assumptions: z.object({
    feeBps: z.number().min(0),
    slippageBps: z.number().min(0),
    startingCapital: z.number().positive(),
    currency: z.string().length(3),
  }),
  validationPlan: z.array(z.string()),
});

export function validateStrategySpec(
  spec: StrategySpec & { unsupportedFeatures?: string[] },
): BacktestValidationResult {
  const parsed = StrategySpecSchema.safeParse(spec);
  const errors: string[] = parsed.success
    ? []
    : parsed.error.issues.map(
        (issue) => `${issue.path.join(".")}: ${issue.message}`,
      );
  const warnings: string[] = [];

  if (!parsed.success) {
    return { valid: false, errors, warnings };
  }

  addUniverseValidation(spec, errors, warnings);
  addSizingValidation(spec, errors);
  addRuleValidation(spec, errors, warnings);
  if (errors.some((error) => /Leverage|Shorting|Derivatives/.test(error))) {
    warnings.push("Unsupported risk profile: enhanced risk warning required.");
  }
  return { valid: errors.length === 0, errors, warnings };
}

function addUniverseValidation(
  spec: StrategySpec,
  errors: string[],
  warnings: string[],
): void {
  const primaryAssets = spec.assetUniverse.filter(
    (asset) => asset.role === "primary",
  );
  if (primaryAssets.length !== 1) {
    errors.push(
      "Exactly one primary asset is required for MVP long-only backtests.",
    );
  }
  if (spec.assetUniverse.some((asset) => asset.role === "rotation_candidate")) {
    warnings.push(
      "Rotation candidates use equal-weight long-only MVP behavior.",
    );
  }
  for (const data of spec.requiredData) {
    if (!SUPPORTED_FIXTURE_INSTRUMENT_IDS.has(data.instrumentId)) {
      errors.push(
        `Unsupported instrument ${data.instrumentId}; MVP backtests require registered fixture market data.`,
      );
    }
    if (data.interval !== "1d") {
      errors.push(
        `Unsupported interval ${data.interval}; MVP engine supports daily candles only.`,
      );
    }
  }
  for (const asset of spec.assetUniverse) {
    if (!SUPPORTED_FIXTURE_INSTRUMENT_IDS.has(asset.instrumentId)) {
      errors.push(
        `Unsupported instrument ${asset.instrumentId}; MVP backtests require registered fixture market data.`,
      );
    }
  }
  if (
    spec.benchmarkId &&
    !SUPPORTED_FIXTURE_INSTRUMENT_IDS.has(spec.benchmarkId)
  ) {
    errors.push(
      `Unsupported benchmark ${spec.benchmarkId}; MVP backtests require registered fixture market data.`,
    );
  }
}

function addSizingValidation(
  spec: StrategySpec & { unsupportedFeatures?: string[] },
  errors: string[],
): void {
  const params = spec.positionSizing.params;
  if (Number(params.leverage ?? 1) > 1) {
    errors.push("Leverage is not supported in MVP backtests.");
  }
  if (params.allowShort === true || params.short === true) {
    errors.push("Shorting is not supported in MVP backtests.");
  }
  if (params.derivative === true || params.instrumentType === "derivative") {
    errors.push("Derivatives are not supported in MVP backtests.");
  }
  if (spec.unsupportedFeatures?.includes("leverage")) {
    errors.push("Leverage is not supported in MVP backtests.");
  }
  if (spec.unsupportedFeatures?.includes("short" as never)) {
    errors.push("Shorting is not supported in MVP backtests.");
  }
}

function addRuleValidation(
  spec: StrategySpec,
  errors: string[],
  warnings: string[],
): void {
  for (const rule of [...spec.entryRules, ...spec.exitRules]) {
    if (
      rule.type !== "moving_average_cross" &&
      rule.type !== "rebalance_schedule"
    ) {
      warnings.push(
        `Rule ${rule.type} is validation-only in the MVP long-only engine.`,
      );
    }
    if (rule.type === "moving_average_cross") {
      const shortWindow = Number(rule.params.shortWindow);
      const longWindow = Number(rule.params.longWindow);
      if (
        !Number.isInteger(shortWindow) ||
        !Number.isInteger(longWindow) ||
        shortWindow >= longWindow
      ) {
        errors.push(
          "Moving average cross requires integer shortWindow less than longWindow.",
        );
      }
    }
  }
}

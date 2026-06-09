import { buildEngineResult } from "./engine-simulation";
import {
  BACKTEST_PAST_PERFORMANCE_CAVEAT,
  validateStrategySpec,
} from "./schema";
import type {
  BacktestEngine,
  BacktestInput,
  BacktestResult,
  StrategySpec,
} from "./types";

export class LongOnlyBacktestEngine implements BacktestEngine {
  async validate(spec: StrategySpec) {
    return validateStrategySpec(spec);
  }

  async run(input: BacktestInput): Promise<BacktestResult> {
    const validation = validateStrategySpec(input.spec);
    if (!validation.valid) {
      throw new Error(`Invalid backtest spec: ${validation.errors.join("; ")}`);
    }
    const result = buildEngineResult(input);
    const [baseWarning, ...rangeWarnings] = result.warnings;
    return {
      ...result,
      warnings:
        baseWarning === undefined
          ? validation.warnings
          : [baseWarning, ...validation.warnings, ...rangeWarnings],
      caveat: BACKTEST_PAST_PERFORMANCE_CAVEAT,
    };
  }
}

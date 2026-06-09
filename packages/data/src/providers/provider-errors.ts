import type { Warning } from "@plutus/domain";

export class MarketDataUnavailableError extends Error {
  readonly code = "market_data_unavailable";
  readonly warnings: Warning[];

  constructor(message: string, warnings: Warning[]) {
    super(message);
    this.name = "MarketDataUnavailableError";
    this.warnings = warnings;
  }
}

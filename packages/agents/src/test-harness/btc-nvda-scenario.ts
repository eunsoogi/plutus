import type { FinalRunCard } from "../codex-run-host/schemas";
import type { ScriptedRunScenario } from "./scripted-run-stream";
import { createFinalRunCard } from "./scripted-run-stream";

export function btcNvdaPortfolioReviewScenario(
  overrides: { finalRunCard?: unknown } = {},
): ScriptedRunScenario {
  return {
    stages: [
      "planning",
      "grounding",
      "executing",
      "debating",
      "validating",
      "reporting",
      "completed",
    ],
    finalRunCard:
      overrides.finalRunCard === undefined
        ? createFinalRunCard()
        : createFinalRunCard(overrides.finalRunCard as Partial<FinalRunCard>),
  };
}

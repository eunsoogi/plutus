import type {
  CodexRunEvent,
  FinalRunCard,
  RunStage,
} from "../codex-run-host/schemas";

export interface ScriptedRunScenario {
  stages: Exclude<RunStage, "failed" | "cancelled">[];
  finalRunCard: unknown;
}

export function eventFor(
  runId: string,
  stage: RunStage,
  type = "stage_completed",
  payload?: unknown,
): CodexRunEvent {
  return {
    runId,
    stage,
    type,
    message: `${stage} ${type}`,
    at: new Date(0).toISOString(),
    payload,
  };
}

export function createFinalRunCard(
  overrides: Partial<FinalRunCard> = {},
): FinalRunCard {
  return {
    runId: "run-btc-nvda",
    profileId: "profile-core",
    title: "BTC/NVDA portfolio review",
    category: "risk_warning",
    riskValidation: "approved_with_warnings",
    summary:
      "BTC and NVDA create concentrated growth exposure with material volatility.",
    warnings: [
      "Concentration exceeds the default single-theme risk budget.",
      "Crypto and semiconductor exposures can draw down at the same time in liquidity stress.",
    ],
    evidenceRefs: ["quote:BTC", "quote:NVDA", "portfolio:core"],
    assumptions: ["MVP uses simulation and read-only portfolio data only."],
    dissentingViews: [
      "NVDA thesis remains strong but valuation and liquidity-cycle risk are elevated.",
    ],
    artifactRefs: ["artifact:run-card", "artifact:mobile-summary"],
    approvalRequired: true,
    ...overrides,
  };
}

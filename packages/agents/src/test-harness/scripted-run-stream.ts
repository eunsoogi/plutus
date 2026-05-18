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
    userRequest:
      "Review BTC and NVDA concentration risk and identify inspection steps.",
    selectedTeam: "portfolio_review_committee",
    category: "risk_warning",
    riskValidation: "approved_with_warnings",
    summary:
      "BTC and NVDA create concentrated growth exposure with material volatility.",
    confidence: "medium",
    warnings: [
      "Concentration exceeds the default single-theme risk budget.",
      "Crypto and semiconductor exposures can draw down at the same time in liquidity stress.",
    ],
    evidenceRefs: ["quote:BTC", "quote:NVDA", "portfolio:core"],
    supportingEvidence: [
      {
        label: "BTC/NVDA concentration",
        sourceRef: "portfolio:core:positions",
      },
      { label: "BTC quote", sourceRef: "quote:BTC" },
    ],
    assumptions: ["MVP uses simulation and read-only portfolio data only."],
    dissentingViews: [
      "NVDA thesis remains strong but valuation and liquidity-cycle risk are elevated.",
    ],
    riskChecklist: [
      {
        check: "Concentration",
        status: "warning",
        evidenceRefs: ["portfolio:core"],
      },
      {
        check: "Freshness",
        status: "warning",
        evidenceRefs: ["quote:BTC"],
      },
    ],
    artifacts: [
      {
        artifactId: "artifact:run-card",
        type: "run_card",
        title: "BTC/NVDA portfolio review",
      },
    ],
    artifactRefs: ["artifact:run-card", "artifact:mobile-summary"],
    limitations: ["Read-only portfolio review; no trade execution authorized."],
    nextActions: [
      "Inspect BTC and NVDA weights against risk limits.",
      "Refresh stale quote inputs before any action.",
    ],
    approvalRequired: true,
    ...overrides,
    freshness: overrides.freshness ?? { delayStatus: "unknown" },
    caveats: overrides.caveats ?? [],
  };
}

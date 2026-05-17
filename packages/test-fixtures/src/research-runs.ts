import { ResearchRunSchema, RunCardSchema } from "@plutus/domain";

import { fixtureIds, fixtureNow } from "./ids";
import { marketData } from "./market-data";

const userRequest =
  "BTC and NVDA exposure together looks risky. Review my portfolio and suggest what to inspect.";

const runCard = RunCardSchema.parse({
  runId: fixtureIds.acceptanceRun,
  userRequest,
  selectedTeam: "portfolio_review",
  recommendationCategory: "risk_warning",
  plainLanguageSummary:
    "BTC and NVDA are both meaningful contributors to portfolio risk; inspect concentration, volatility, and liquidity assumptions before adding exposure.",
  confidence: "medium",
  supportingEvidence: [
    {
      label: "BTC/NVDA concentration",
      sourceRef: "portfolio:Core:positions",
      freshness: marketData.freshness.stale,
    },
    {
      label: "NVDA quote",
      sourceRef: "quote:NVDA",
      freshness: marketData.freshness.realtime,
    },
  ],
  dissentingViews: [
    "NVDA has strong earnings momentum.",
    "BTC data is stale enough to limit confidence in short-term conclusions.",
  ],
  riskChecklist: [
    {
      check: "Concentration",
      status: "warning",
      evidenceRefs: ["portfolio:Core:positions"],
    },
    { check: "Freshness", status: "warning", evidenceRefs: ["quote:BTC"] },
  ],
  artifacts: [
    {
      artifactId: fixtureIds.runArtifact,
      type: "run_card",
      title: "BTC/NVDA Portfolio Review",
    },
  ],
  limitations: ["Fixture data is deterministic and not live market data."],
  nextActions: [
    "Inspect BTC and NVDA weights against risk limits.",
    "Refresh stale BTC quote before action.",
  ],
});

export const acceptanceResearchRun = {
  ...ResearchRunSchema.parse({
    id: fixtureIds.acceptanceRun,
    profileId: fixtureIds.profile,
    portfolioId: fixtureIds.corePortfolio,
    status: "completed",
    userRequest,
    selectedTeam: "portfolio_review",
    codexThreadId: "fixture-thread-btc-nvda",
    workspacePath: "/tmp/plutus-fixture-runs/btc-nvda",
    customAgentVersions: {
      orchestrator: "fixture",
      risk_manager: "fixture",
    },
    localToolConfigHash: "fixture-local-tool-config",
    modelConfig: { mode: "deterministic" },
    recommendationCategory: "risk_warning",
    confidence: "medium",
    startedAt: fixtureNow,
    completedAt: "2026-05-17T00:05:00.000Z",
    failureReason: null,
  }),
  runCard,
} as const;

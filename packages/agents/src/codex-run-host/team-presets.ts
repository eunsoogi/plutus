import type { StartResearchRunInput } from "./codex-run-host";

const teamPresets = {
  portfolio_review_committee: {
    agents: [
      "market_data_researcher",
      "portfolio_manager",
      "risk_manager",
      "report_writer",
    ],
    namespaces: [
      "plutus_portfolio",
      "plutus_market_data",
      "plutus_risk",
      "plutus_memory",
      "plutus_reports",
      "plutus_audit",
    ],
    writableNamespaces: [
      "plutus_risk",
      "plutus_reports",
      "plutus_memory",
      "plutus_audit",
    ],
  },
  investment_committee: {
    agents: [
      "equity_analyst",
      "technical_analyst",
      "portfolio_manager",
      "risk_manager",
      "report_writer",
    ],
    namespaces: [
      "plutus_market_data",
      "plutus_research",
      "plutus_portfolio",
      "plutus_risk",
      "plutus_memory",
      "plutus_reports",
      "plutus_audit",
    ],
    writableNamespaces: [
      "plutus_risk",
      "plutus_reports",
      "plutus_memory",
      "plutus_audit",
    ],
  },
  crypto_research_desk: {
    agents: [
      "crypto_analyst",
      "technical_analyst",
      "quant_strategy_researcher",
      "risk_manager",
      "report_writer",
    ],
    namespaces: [
      "plutus_market_data",
      "plutus_research",
      "plutus_backtest",
      "plutus_risk",
      "plutus_reports",
      "plutus_audit",
    ],
    writableNamespaces: [
      "plutus_backtest",
      "plutus_risk",
      "plutus_reports",
      "plutus_audit",
    ],
  },
  quant_strategy_desk: {
    agents: [
      "market_data_researcher",
      "quant_strategy_researcher",
      "risk_manager",
      "report_writer",
    ],
    namespaces: [
      "plutus_market_data",
      "plutus_backtest",
      "plutus_risk",
      "plutus_reports",
      "plutus_audit",
      "plutus_memory",
    ],
    writableNamespaces: [
      "plutus_backtest",
      "plutus_risk",
      "plutus_reports",
      "plutus_audit",
    ],
  },
  technical_analysis_panel: {
    agents: [
      "market_data_researcher",
      "technical_analyst",
      "risk_manager",
      "report_writer",
    ],
    namespaces: [
      "plutus_market_data",
      "plutus_risk",
      "plutus_reports",
      "plutus_audit",
    ],
    writableNamespaces: ["plutus_risk", "plutus_reports", "plutus_audit"],
  },
  strategy_exploration_panel: {
    agents: [
      "quant_strategy_researcher",
      "portfolio_manager",
      "risk_manager",
      "report_writer",
    ],
    namespaces: [
      "plutus_portfolio",
      "plutus_market_data",
      "plutus_backtest",
      "plutus_risk",
      "plutus_reports",
      "plutus_research",
      "plutus_audit",
    ],
    writableNamespaces: [
      "plutus_backtest",
      "plutus_risk",
      "plutus_reports",
      "plutus_audit",
    ],
  },
  knowledge_curation_desk: {
    agents: ["llm_wiki_curator", "report_writer"],
    namespaces: [
      "plutus_memory",
      "plutus_wiki",
      "plutus_reports",
      "plutus_research",
      "plutus_audit",
    ],
    writableNamespaces: [
      "plutus_memory",
      "plutus_wiki",
      "plutus_reports",
      "plutus_audit",
    ],
  },
} as const;

export type PlutusResearchTeam = keyof typeof teamPresets;

export function resolveSelectedTeam(
  input: Pick<StartResearchRunInput, "selectedTeam">,
): PlutusResearchTeam {
  const selectedTeam = input.selectedTeam ?? "portfolio_review_committee";
  if (!(selectedTeam in teamPresets)) {
    throw new Error(`Unknown Plutus team preset: ${selectedTeam}.`);
  }
  return selectedTeam as PlutusResearchTeam;
}

export function teamAgentsFor(selectedTeam: PlutusResearchTeam): string[] {
  return [...teamPresets[selectedTeam].agents];
}

export function teamNamespacesFor(selectedTeam: PlutusResearchTeam): string[] {
  return [...teamPresets[selectedTeam].namespaces];
}

export function teamWritableNamespacesFor(
  selectedTeam: PlutusResearchTeam,
): string[] {
  return [...teamPresets[selectedTeam].writableNamespaces];
}

export function rootSandboxModeForTeam(selectedTeam: PlutusResearchTeam) {
  return teamWritableNamespacesFor(selectedTeam).length > 0
    ? ("workspace-write" as const)
    : ("read-only" as const);
}

export type SpecialistId =
  | "crypto_analyst"
  | "equity_analyst"
  | "llm_wiki_curator"
  | "market_data_researcher"
  | "portfolio_manager"
  | "quant_strategy_researcher"
  | "report_writer"
  | "risk_manager"
  | "technical_analyst";

export const defaultTeam = "portfolio_review_committee";

export const teamSpecialists = {
  portfolio_review_committee: [
    "market_data_researcher",
    "portfolio_manager",
    "risk_manager",
    "report_writer",
  ],
  investment_committee: [
    "equity_analyst",
    "technical_analyst",
    "portfolio_manager",
    "risk_manager",
    "report_writer",
  ],
  crypto_research_desk: [
    "crypto_analyst",
    "technical_analyst",
    "quant_strategy_researcher",
    "risk_manager",
    "report_writer",
  ],
  quant_strategy_desk: [
    "market_data_researcher",
    "quant_strategy_researcher",
    "risk_manager",
    "report_writer",
  ],
  technical_analysis_panel: [
    "market_data_researcher",
    "technical_analyst",
    "risk_manager",
    "report_writer",
  ],
  strategy_exploration_panel: [
    "quant_strategy_researcher",
    "portfolio_manager",
    "risk_manager",
    "report_writer",
  ],
  knowledge_curation_desk: ["llm_wiki_curator", "report_writer"],
} satisfies Record<string, readonly SpecialistId[]>;

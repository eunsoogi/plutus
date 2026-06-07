import type { AppLocale } from "./core";

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
} as const satisfies Record<string, readonly SpecialistId[]>;

export type TeamId = keyof typeof teamSpecialists;

export const orderedTeamIds = [
  "portfolio_review_committee",
  "investment_committee",
  "crypto_research_desk",
  "quant_strategy_desk",
  "technical_analysis_panel",
  "strategy_exploration_panel",
  "knowledge_curation_desk",
] as const satisfies readonly TeamId[];

const specialistCallSigns = {
  crypto_analyst: "CA",
  equity_analyst: "EQ",
  llm_wiki_curator: "WK",
  market_data_researcher: "MD",
  portfolio_manager: "PM",
  quant_strategy_researcher: "QS",
  report_writer: "RW",
  risk_manager: "RM",
  technical_analyst: "TA",
} satisfies Record<SpecialistId, string>;

const officeTeamLabels = {
  en: {
    portfolio_review_committee: "Portfolio Review Committee",
    investment_committee: "Investment Committee",
    crypto_research_desk: "Crypto Research Desk",
    quant_strategy_desk: "Quant Strategy Desk",
    technical_analysis_panel: "Technical Analysis Panel",
    strategy_exploration_panel: "Strategy Exploration Panel",
    knowledge_curation_desk: "Knowledge Curation Desk",
  },
  ko: {
    portfolio_review_committee: "포트폴리오 리뷰 위원회",
    investment_committee: "투자 위원회",
    crypto_research_desk: "크립토 리서치 데스크",
    quant_strategy_desk: "퀀트 전략 데스크",
    technical_analysis_panel: "기술 분석 패널",
    strategy_exploration_panel: "전략 탐색 패널",
    knowledge_curation_desk: "지식 큐레이션 데스크",
  },
} satisfies Record<AppLocale, Record<TeamId, string>>;

export function isKnownTeam(team: string): team is TeamId {
  return Object.hasOwn(teamSpecialists, team);
}

export function officeTeamLabel(team: string, locale: AppLocale): string {
  return isKnownTeam(team) ? officeTeamLabels[locale][team] : team;
}

export function specialistCallSign(specialist: SpecialistId): string {
  return specialistCallSigns[specialist];
}

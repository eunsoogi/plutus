import type { AppLocale } from "./core";

export const officeCopy = {
  en: {
    title: "Orchestrator Office",
    orchestrator: "Research Orchestrator",
    selectedTeam: "Selected team",
    safety: "No live trading",
    evidence: "Evidence",
    risk: "Risk checks",
    noEvidence: "No evidence attached",
    noRisk: "No risk checks yet",
    check: "check",
    unknown: "unknown",
    stage: {
      planning: "Planning",
      executing: "Executing",
      validating: "Validating",
      reporting: "Reporting",
      completed: "Completed",
    },
    specialist: {
      market_data_researcher: "Market Data Researcher",
      portfolio_manager: "Portfolio Manager",
      risk_manager: "Risk Manager",
      report_writer: "Report Writer",
    },
  },
  ko: {
    title: "오케스트레이터 오피스",
    orchestrator: "리서치 오케스트레이터",
    selectedTeam: "선택된 팀",
    safety: "실거래 없음",
    evidence: "근거",
    risk: "리스크 점검",
    noEvidence: "연결된 근거 없음",
    noRisk: "리스크 점검 대기",
    check: "점검",
    unknown: "알 수 없음",
    stage: {
      planning: "계획",
      executing: "실행",
      validating: "검증",
      reporting: "보고",
      completed: "완료",
    },
    specialist: {
      market_data_researcher: "시장 데이터 리서처",
      portfolio_manager: "포트폴리오 매니저",
      risk_manager: "리스크 매니저",
      report_writer: "보고서 작성자",
    },
  },
} satisfies Record<AppLocale, Record<string, unknown>>;

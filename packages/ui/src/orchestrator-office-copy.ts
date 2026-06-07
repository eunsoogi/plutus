import type { AppLocale } from "./core";
import type { OfficeRotation } from "./orchestrator-office-canvas-types";

export type OfficeStationLabels = {
  readonly market_desk: string;
  readonly strategy_board: string;
  readonly risk_table: string;
  readonly report_bay: string;
  readonly signal_booth: string;
  readonly command_table: string;
};

export type OfficeRotationLabels = Readonly<Record<OfficeRotation, string>>;

export type OfficeCanvasChromeLabels = {
  readonly agentCount: (agentCount: number) => string;
  readonly hqConnected: string;
  readonly canvas: string;
  readonly openHq: string;
  readonly market: string;
  readonly analytics: string;
  readonly eventConsole: string;
  readonly noLiveTrading: string;
};

export const officeCopy = {
  en: {
    title: "Orchestrator Office",
    orchestrator: "Research Orchestrator",
    selectedTeam: "Selected team",
    activeTeam: "Active team",
    activeDesks: "Active desks",
    orientation: "Orientation",
    rotateLeft: "Rotate left",
    rotateRight: "Rotate right",
    rotateLeftControl: "Left",
    rotateRightControl: "Right",
    canvasChrome: {
      agentCount: (agentCount: number) => `${agentCount} agents`,
      hqConnected: "HQ connected",
      canvas: "Canvas",
      openHq: "Open HQ",
      market: "Market",
      analytics: "Analytics",
      eventConsole: "PLUTUS EVENT CONSOLE",
      noLiveTrading: "No live trading",
    } satisfies OfficeCanvasChromeLabels,
    rotation: {
      "south-east": "South East",
      "south-west": "South West",
      "north-west": "North West",
      "north-east": "North East",
    } satisfies OfficeRotationLabels,
    safety: "No live trading",
    evidence: "Evidence",
    risk: "Risk checks",
    noEvidence: "No evidence attached",
    noRisk: "No risk checks yet",
    check: "check",
    unknown: "unknown",
    station: {
      market_desk: "Market desk",
      strategy_board: "Strategy board",
      risk_table: "Risk table",
      report_bay: "Report bay",
      signal_booth: "Signal booth",
      command_table: "Command table",
    } satisfies OfficeStationLabels,
    stage: {
      planning: "Planning",
      executing: "Executing",
      validating: "Validating",
      reporting: "Reporting",
      completed: "Completed",
    },
    specialist: {
      crypto_analyst: "Crypto Analyst",
      equity_analyst: "Equity Analyst",
      llm_wiki_curator: "Wiki Curator",
      market_data_researcher: "Market Data Researcher",
      portfolio_manager: "Portfolio Manager",
      quant_strategy_researcher: "Quant Strategy Researcher",
      risk_manager: "Risk Manager",
      report_writer: "Report Writer",
      technical_analyst: "Technical Analyst",
    },
  },
  ko: {
    title: "오케스트레이터 오피스",
    orchestrator: "리서치 오케스트레이터",
    selectedTeam: "선택된 팀",
    activeTeam: "활성 팀",
    activeDesks: "가동 중인 데스크",
    orientation: "방향",
    rotateLeft: "왼쪽 회전",
    rotateRight: "오른쪽 회전",
    rotateLeftControl: "왼쪽",
    rotateRightControl: "오른쪽",
    canvasChrome: {
      agentCount: (agentCount: number) => `에이전트 ${agentCount}명`,
      hqConnected: "HQ 연결됨",
      canvas: "캔버스",
      openHq: "본부 열기",
      market: "시장",
      analytics: "분석",
      eventConsole: "PLUTUS 이벤트 콘솔",
      noLiveTrading: "실거래 없음",
    } satisfies OfficeCanvasChromeLabels,
    rotation: {
      "south-east": "남동쪽",
      "south-west": "남서쪽",
      "north-west": "북서쪽",
      "north-east": "북동쪽",
    } satisfies OfficeRotationLabels,
    safety: "실거래 없음",
    evidence: "근거",
    risk: "리스크 점검",
    noEvidence: "연결된 근거 없음",
    noRisk: "리스크 점검 대기",
    check: "점검",
    unknown: "알 수 없음",
    station: {
      market_desk: "시장 데스크",
      strategy_board: "전략 보드",
      risk_table: "리스크 테이블",
      report_bay: "보고 구역",
      signal_booth: "시그널 부스",
      command_table: "지휘 테이블",
    } satisfies OfficeStationLabels,
    stage: {
      planning: "계획",
      executing: "실행",
      validating: "검증",
      reporting: "보고",
      completed: "완료",
    },
    specialist: {
      crypto_analyst: "크립토 애널리스트",
      equity_analyst: "주식 애널리스트",
      llm_wiki_curator: "위키 큐레이터",
      market_data_researcher: "시장 데이터 리서처",
      portfolio_manager: "포트폴리오 매니저",
      quant_strategy_researcher: "퀀트 전략 리서처",
      risk_manager: "리스크 매니저",
      report_writer: "보고서 작성자",
      technical_analyst: "기술적 분석가",
    },
  },
} satisfies Record<AppLocale, Record<string, unknown>>;

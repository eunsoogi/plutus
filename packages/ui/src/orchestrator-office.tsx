import type { AppLocale } from "./core";
import { useI18n } from "./i18n";

type EvidenceItem = {
  readonly label?: string;
  readonly sourceRef?: string;
};

type RiskItem = {
  readonly check?: string;
  readonly status?: string;
};

export type OrchestratorOfficeRun = {
  readonly id: string;
  readonly title: string;
  readonly status: string;
  readonly category: string;
  readonly selectedTeam?: string;
  readonly finalCard?: {
    readonly selectedTeam?: string;
    readonly supportingEvidence?: readonly EvidenceItem[];
    readonly riskChecklist?: readonly RiskItem[];
  };
};

type SpecialistId =
  | "market_data_researcher"
  | "portfolio_manager"
  | "risk_manager"
  | "report_writer";

const defaultTeam = "portfolio_review_committee";

const teamSpecialists = {
  portfolio_review_committee: [
    "market_data_researcher",
    "portfolio_manager",
    "risk_manager",
    "report_writer",
  ],
} satisfies Record<string, readonly SpecialistId[]>;

const copy = {
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
      grounding: "Grounding",
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
      grounding: "근거 수집",
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

function selectedTeamFor(run: OrchestratorOfficeRun) {
  return run.finalCard?.selectedTeam ?? run.selectedTeam ?? defaultTeam;
}

function specialistsFor(team: string): readonly SpecialistId[] {
  return team in teamSpecialists
    ? teamSpecialists[team as keyof typeof teamSpecialists]
    : teamSpecialists[defaultTeam];
}

function stageFor(run: OrchestratorOfficeRun, locale: AppLocale) {
  const labels = copy[locale].stage;
  if (run.status === "completed") return labels.completed;
  if (run.finalCard) return labels.reporting;
  if (run.category) return labels.validating;
  if (run.status === "queued" || run.status === "ready") return labels.planning;
  return labels.executing;
}

function evidenceSummary(run: OrchestratorOfficeRun, locale: AppLocale) {
  const first = run.finalCard?.supportingEvidence?.[0];
  return first?.label ?? first?.sourceRef ?? copy[locale].noEvidence;
}

function riskSummary(run: OrchestratorOfficeRun, locale: AppLocale) {
  const first = run.finalCard?.riskChecklist?.[0];
  if (!first) return copy[locale].noRisk;
  return `${first.check ?? copy[locale].check}: ${
    first.status ?? copy[locale].unknown
  }`;
}

export function OrchestratorOffice({ run }: { run: OrchestratorOfficeRun }) {
  const { locale } = useI18n();
  if (!run.id) return null;

  const text = copy[locale];
  const team = selectedTeamFor(run);
  const specialists = specialistsFor(team);
  return (
    <section
      className="panel orchestrator-office"
      data-testid="orchestrator-office"
    >
      <div className="orchestrator-office__header">
        <div>
          <h2>{text.title}</h2>
          <p>
            {text.selectedTeam}: <strong>{team}</strong>
          </p>
        </div>
        <span className="pill">{text.safety}</span>
      </div>
      <div className="orchestrator-office__map">
        <div
          className="orchestrator-office__orchestrator"
          data-testid="orchestrator-node"
        >
          <span>{text.orchestrator}</span>
          <strong>{stageFor(run, locale)}</strong>
          <small>{run.status}</small>
        </div>
        <div className="orchestrator-office__agents">
          {specialists.map((specialist) => (
            <div
              className="orchestrator-office__agent"
              data-testid={`orchestrator-agent-${specialist}`}
              key={specialist}
            >
              <strong>{text.specialist[specialist]}</strong>
              <span>{stageFor(run, locale)}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="orchestrator-office__signals">
        <div>
          <span>{text.evidence}</span>
          <strong>{evidenceSummary(run, locale)}</strong>
        </div>
        <div>
          <span>{text.risk}</span>
          <strong>{riskSummary(run, locale)}</strong>
        </div>
      </div>
    </section>
  );
}

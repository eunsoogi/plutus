import type { AppLocale } from "./core";
import { useI18n } from "./i18n";
import { officeCopy } from "./orchestrator-office-copy";

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

const officeSpots = [
  ["market_data_researcher", 172, 128, "#62d3e7"],
  ["portfolio_manager", 578, 128, "#80e0a7"],
  ["risk_manager", 172, 312, "#f5b84b"],
  ["report_writer", 578, 312, "#a7b7ff"],
] satisfies readonly [SpecialistId, number, number, string][];

function selectedTeamFor(run: OrchestratorOfficeRun) {
  return run.finalCard?.selectedTeam ?? run.selectedTeam ?? defaultTeam;
}

function specialistsFor(team: string): readonly SpecialistId[] {
  return team in teamSpecialists
    ? teamSpecialists[team as keyof typeof teamSpecialists]
    : teamSpecialists[defaultTeam];
}

function stageFor(run: OrchestratorOfficeRun, locale: AppLocale) {
  const labels = officeCopy[locale].stage;
  if (run.status === "completed") return labels.completed;
  if (run.finalCard) return labels.reporting;
  if (run.category) return labels.validating;
  if (run.status === "queued" || run.status === "ready") return labels.planning;
  return labels.executing;
}

function evidenceSummary(run: OrchestratorOfficeRun, locale: AppLocale) {
  const first = run.finalCard?.supportingEvidence?.[0];
  return first?.label ?? first?.sourceRef ?? officeCopy[locale].noEvidence;
}

function riskSummary(run: OrchestratorOfficeRun, locale: AppLocale) {
  const first = run.finalCard?.riskChecklist?.[0];
  if (!first) return officeCopy[locale].noRisk;
  return `${first.check ?? officeCopy[locale].check}: ${
    first.status ?? officeCopy[locale].unknown
  }`;
}

function AgentDesk({
  color,
  label,
  specialist,
  stage,
  x,
  y,
}: {
  readonly color: string;
  readonly label: string;
  readonly specialist: SpecialistId;
  readonly stage: string;
  readonly x: number;
  readonly y: number;
}) {
  return (
    <g
      className="office-agent"
      data-testid={`orchestrator-agent-${specialist}`}
      transform={`translate(${x} ${y})`}
    >
      <polygon
        className="office-desk-top"
        points="-70,-24 20,-48 86,-16 -4,16"
      />
      <polygon className="office-desk-side" points="-4,16 86,-16 86,18 -4,50" />
      <polygon
        className="office-desk-front"
        points="-70,-24 -4,16 -4,50 -70,12"
      />
      <circle className="office-avatar-shadow" cx="-8" cy="-22" r="22" />
      <circle className="office-avatar" cx="-8" cy="-30" r="18" fill={color} />
      <rect className="office-laptop" x="28" y="-30" width="28" height="18" />
      <text className="office-label" x="-72" y="78">
        {label}
      </text>
      <text className="office-stage" x="-72" y="98">
        {stage}
      </text>
    </g>
  );
}

export function OrchestratorOffice({ run }: { run: OrchestratorOfficeRun }) {
  const { locale } = useI18n();
  if (!run.id) return null;

  const text = officeCopy[locale];
  const team = selectedTeamFor(run);
  const specialists = new Set(specialistsFor(team));
  const stage = stageFor(run, locale);
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
      <svg
        className="orchestrator-office__scene"
        data-testid="orchestrator-office-scene"
        role="img"
        viewBox="0 0 800 500"
      >
        <title>
          {text.title}: {text.orchestrator}
        </title>
        <polygon
          className="office-floor"
          data-testid="orchestrator-office-floor"
          points="400,42 760,210 400,452 40,210"
        />
        <path
          className="office-grid"
          d="M190 140 550 370M310 92 670 260M70 220 430 450M580 110 220 360M700 190 340 430M460 60 100 270"
        />
        {officeSpots.map(([, x, y]) => (
          <line
            className="office-link"
            key={`${x}-${y}`}
            x1="400"
            x2={x}
            y1="224"
            y2={y}
          />
        ))}
        <g className="office-orchestrator" data-testid="orchestrator-node">
          <polygon
            className="office-command-rug"
            points="400,158 516,212 400,286 284,212"
          />
          <polygon
            className="office-desk-top"
            points="330,186 420,158 488,196 396,230"
          />
          <polygon
            className="office-desk-side"
            points="396,230 488,196 488,236 396,272"
          />
          <polygon
            className="office-desk-front"
            points="330,186 396,230 396,272 330,228"
          />
          <circle className="office-avatar-shadow" cx="406" cy="166" r="28" />
          <circle
            className="office-avatar office-avatar--lead"
            cx="406"
            cy="154"
            r="23"
          />
          <rect
            className="office-laptop"
            x="438"
            y="188"
            width="34"
            height="22"
          />
          <text className="office-label office-label--lead" x="320" y="318">
            {text.orchestrator}
          </text>
          <text className="office-stage office-stage--lead" x="320" y="340">
            {stage} · {run.status}
          </text>
        </g>
        {officeSpots.map(([specialist, x, y, color]) =>
          specialists.has(specialist) ? (
            <AgentDesk
              color={color}
              key={specialist}
              label={text.specialist[specialist]}
              specialist={specialist}
              stage={stage}
              x={x}
              y={y}
            />
          ) : null,
        )}
      </svg>
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

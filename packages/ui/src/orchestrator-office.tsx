import type { AppLocale } from "./core";
import { useI18n } from "./i18n";
import { officeCopy } from "./orchestrator-office-copy";
import { OrchestratorOfficeScene } from "./orchestrator-office-scene";
import {
  defaultTeam,
  teamSpecialists,
  type SpecialistId,
} from "./orchestrator-office-teams";

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

function selectedTeamFor(run: OrchestratorOfficeRun) {
  return run.selectedTeam ?? run.finalCard?.selectedTeam ?? defaultTeam;
}

function isKnownTeam(team: string): team is keyof typeof teamSpecialists {
  return Object.hasOwn(teamSpecialists, team);
}

function specialistsFor(team: string): readonly SpecialistId[] {
  return isKnownTeam(team)
    ? teamSpecialists[team]
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

export function sceneStageLabel(stage: string, status: string) {
  void status;
  return stage;
}

export function OrchestratorOffice({ run }: { run: OrchestratorOfficeRun }) {
  const { locale } = useI18n();
  if (!run.id) return null;

  const text = officeCopy[locale];
  const team = selectedTeamFor(run);
  const specialists = specialistsFor(team);
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
      <OrchestratorOfficeScene
        orchestratorLabel={text.orchestrator}
        stationLabels={text.station}
        specialistLabels={text.specialist}
        specialists={specialists}
        stage={sceneStageLabel(stage, run.status)}
      />
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

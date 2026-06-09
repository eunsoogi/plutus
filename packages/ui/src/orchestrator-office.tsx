import { useCallback, useEffect, useState } from "react";
import type { AppLocale } from "./core";
import { useI18n } from "./i18n";
import {
  DEFAULT_OFFICE_PITCH,
  nextOfficeYaw,
  normalizeOfficePitch,
  normalizeOfficeYaw,
  officeRotationForYaw,
  officeYawForRotation,
} from "./orchestrator-office-canvas-geometry";
import type { OfficeRotationDirection } from "./orchestrator-office-canvas-types";
import { officeCopy } from "./orchestrator-office-copy";
import { OrchestratorOfficeScene } from "./orchestrator-office-scene";
import { slotFor } from "./orchestrator-office-scene-data";
import {
  defaultTeam,
  isKnownTeam,
  officeTeamLabel,
  orderedTeamIds,
  specialistCallSign,
  teamSpecialists,
  type TeamId,
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

function selectedTeamFor(run: OrchestratorOfficeRun): string {
  return run.selectedTeam ?? run.finalCard?.selectedTeam ?? defaultTeam;
}

function rosterTeamFor(selectedTeam: string): TeamId {
  return isKnownTeam(selectedTeam) ? selectedTeam : defaultTeam;
}

function specialistsFor(team: TeamId): readonly SpecialistId[] {
  return teamSpecialists[team];
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
  if (!run.id) return null;

  return <OrchestratorOfficeContent run={run} />;
}

function OrchestratorOfficeContent({ run }: { run: OrchestratorOfficeRun }) {
  const { locale } = useI18n();
  const text = officeCopy[locale];
  const [selectedTeam, setSelectedTeam] = useState(() => selectedTeamFor(run));
  const [angle, setAngle] = useState(() => officeYawForRotation("south-east"));
  const [pitch, setPitch] = useState(DEFAULT_OFFICE_PITCH);

  useEffect(() => {
    setSelectedTeam(selectedTeamFor(run));
  }, [run.finalCard?.selectedTeam, run.id, run.selectedTeam]);

  const rotateOffice = useCallback((direction: OfficeRotationDirection) => {
    setAngle((currentAngle) => nextOfficeYaw(currentAngle, direction));
  }, []);
  const dragOfficeAngle = useCallback((deltaX: number, deltaY: number) => {
    setAngle((currentAngle) =>
      normalizeOfficeYaw(currentAngle + deltaX * 0.35),
    );
    setPitch((currentPitch) =>
      normalizeOfficePitch(currentPitch - deltaY * 0.12),
    );
  }, []);

  const activeTeam = rosterTeamFor(selectedTeam);
  const selectedTeamLabel = officeTeamLabel(selectedTeam, locale);
  const activeTeamLabel = officeTeamLabel(activeTeam, locale);
  const teamOptions: readonly string[] = isKnownTeam(selectedTeam)
    ? orderedTeamIds
    : [selectedTeam, ...orderedTeamIds];
  const rotation = officeRotationForYaw(angle);
  const rotationLabel = text.rotation[rotation];
  const specialists = specialistsFor(activeTeam);
  const stage = stageFor(run, locale);
  const teamRoster = specialists.map((specialist, index) => ({
    id: specialist,
    callSign: specialistCallSign(specialist),
    label: text.specialist[specialist],
    station: slotFor(index, text.station).station,
  }));

  return (
    <section
      className="panel orchestrator-office"
      data-testid="orchestrator-office"
    >
      <div className="orchestrator-office__header">
        <div className="orchestrator-office__heading">
          <div>
            <h2>{text.title}</h2>
            <p>
              {text.selectedTeam}:{" "}
              <strong data-testid="orchestrator-office-team-name">
                {selectedTeamLabel}
              </strong>
            </p>
          </div>
          <div className="orchestrator-office__status">
            <span className="orchestrator-office__status-label">{stage}</span>
            <span className="pill">{text.safety}</span>
          </div>
        </div>
      </div>
      <div className="orchestrator-office__experience">
        <div className="orchestrator-office__scene-shell">
          <div className="orchestrator-office__controls">
            <label className="orchestrator-office__team-control">
              <span>{text.activeTeam}</span>
              <select
                data-testid="orchestrator-office-team-select"
                onChange={(event) => {
                  setSelectedTeam(event.currentTarget.value);
                }}
                value={selectedTeam}
              >
                {teamOptions.map((teamId) => (
                  <option key={teamId} value={teamId}>
                    {officeTeamLabel(teamId, locale)}
                  </option>
                ))}
              </select>
            </label>
            <div className="orchestrator-office__rotation-control">
              <span>{text.orientation}</span>
              <div className="orchestrator-office__rotation-buttons">
                <button
                  aria-label={text.rotateLeft}
                  data-testid="orchestrator-office-rotate-left"
                  onClick={() => rotateOffice("left")}
                  type="button"
                >
                  {text.rotateLeftControl}
                </button>
                <strong data-testid="orchestrator-office-rotation-label">
                  {rotationLabel}
                </strong>
                <button
                  aria-label={text.rotateRight}
                  data-testid="orchestrator-office-rotate-right"
                  onClick={() => rotateOffice("right")}
                  type="button"
                >
                  {text.rotateRightControl}
                </button>
              </div>
            </div>
          </div>
          <OrchestratorOfficeScene
            angle={angle}
            canvasChromeLabels={text.canvasChrome}
            locale={locale}
            orchestratorLabel={text.orchestrator}
            onAngleDrag={dragOfficeAngle}
            pitch={pitch}
            rotation={rotation}
            stage={sceneStageLabel(stage, run.status)}
            stationLabels={text.station}
            specialistLabels={text.specialist}
            specialists={specialists}
            teamId={activeTeam}
            teamLabel={activeTeamLabel}
          />
        </div>
        <aside
          className="orchestrator-office__roster"
          data-testid="orchestrator-office-roster"
        >
          <span className="orchestrator-office__roster-label">
            {text.activeDesks}
          </span>
          {teamRoster.map((specialist) => (
            <article
              className="orchestrator-office__roster-item"
              key={specialist.id}
            >
              <span className="orchestrator-office__roster-chip">
                {specialist.callSign}
              </span>
              <div>
                <strong>{specialist.label}</strong>
                <span>{specialist.station}</span>
              </div>
            </article>
          ))}
        </aside>
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

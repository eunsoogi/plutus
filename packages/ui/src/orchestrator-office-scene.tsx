import { useMemo } from "react";
import type { AppLocale } from "./core";
import type {
  OfficeCanvasChromeLabels,
  OfficeStationLabels,
} from "./orchestrator-office-copy";
import { DEFAULT_OFFICE_PITCH } from "./orchestrator-office-canvas-geometry";
import type { OfficeRotation } from "./orchestrator-office-canvas-types";
import {
  slotFor,
  specialistAgent,
  type OfficeAgent,
} from "./orchestrator-office-scene-data";
import type { SpecialistId, TeamId } from "./orchestrator-office-teams";
import { OrchestratorOfficeThreeView } from "./orchestrator-office-three-view";

export function OrchestratorOfficeScene({
  angle,
  canvasChromeLabels,
  onAngleDrag,
  orchestratorLabel,
  locale = "en",
  stationLabels,
  specialistLabels,
  specialists,
  stage,
  teamId,
  teamLabel,
  pitch = DEFAULT_OFFICE_PITCH,
  rotation,
}: {
  readonly angle: number;
  readonly canvasChromeLabels: OfficeCanvasChromeLabels;
  readonly locale?: AppLocale;
  readonly onAngleDrag: (deltaX: number, deltaY: number) => void;
  readonly orchestratorLabel: string;
  readonly pitch?: number;
  readonly rotation: OfficeRotation;
  readonly stationLabels: OfficeStationLabels;
  readonly specialistLabels: Record<SpecialistId, string>;
  readonly specialists: readonly SpecialistId[];
  readonly stage: string;
  readonly teamId?: TeamId;
  readonly teamLabel: string;
}) {
  const agents: readonly OfficeAgent[] = useMemo(
    () => [
      {
        id: "orchestrator",
        isLead: true,
        label: orchestratorLabel,
        role: stage,
        shortLabel: "O",
        station: stationLabels.command_table,
        testId: "orchestrator-node",
        tile: { x: 5.22, y: 4.5 },
        tone: "lead",
      },
      ...specialists.map((specialist, index) =>
        specialistAgent(
          specialist,
          index,
          specialistLabels[specialist],
          stationLabels,
        ),
      ),
    ],
    [orchestratorLabel, specialistLabels, specialists, stage, stationLabels],
  );
  const deskSlots = useMemo(
    () => specialists.map((_, index) => slotFor(index, stationLabels)),
    [specialists, stationLabels],
  );
  const canvasScene = useMemo(
    () => ({
      agents,
      angle,
      deskSlots,
      pitch,
      rotation,
    }),
    [agents, angle, deskSlots, pitch, rotation],
  );

  return (
    <div
      aria-label={`${orchestratorLabel}: ${stage}`}
      className="orchestrator-office__scene pixel-office"
      data-testid="orchestrator-office-scene"
      data-office-rotation={rotation}
    >
      <div className="pixel-office__status-strip" aria-hidden="true">
        <span className="pixel-office__brand">PLUTUS OFFICE</span>
        <span className="pixel-office__focus">{teamLabel}</span>
        <span>{stage}</span>
      </div>
      <div
        className="pixel-office__top-controls"
        aria-hidden="true"
        data-testid="orchestrator-office-top-controls"
      >
        <span>{canvasChromeLabels.agentCount(agents.length)}</span>
        <span>{canvasChromeLabels.hqConnected}</span>
        <span>{canvasChromeLabels.canvas}</span>
      </div>
      <div
        className="pixel-office__side-tabs"
        aria-hidden="true"
        data-testid="orchestrator-office-side-tabs"
      >
        <span>{canvasChromeLabels.openHq}</span>
        <span>{canvasChromeLabels.market}</span>
        <span>{canvasChromeLabels.analytics}</span>
      </div>
      <OrchestratorOfficeThreeView
        locale={locale}
        onAngleDrag={onAngleDrag}
        rotation={rotation}
        scene={canvasScene}
        stage={stage}
        teamId={teamId}
      />
      <ul
        className="orchestrator-office__scene-mirror"
        data-testid="orchestrator-office-canvas-mirror"
      >
        {agents.map((agent) => (
          <li
            data-agent-id={agent.id}
            data-testid="orchestrator-office-agent-mirror"
            key={agent.id}
          >
            <strong>{agent.label}</strong>
            <span>{agent.station}</span>
            {agent.isLead === true ? <span>{agent.role}</span> : null}
          </li>
        ))}
      </ul>
      <div
        className="orchestrator-office__scene-console"
        data-testid="orchestrator-office-event-console"
      >
        <span>{canvasChromeLabels.eventConsole}</span>
        <span>{canvasChromeLabels.agentCount(agents.length)}</span>
        <span>{canvasChromeLabels.noLiveTrading}</span>
      </div>
    </div>
  );
}

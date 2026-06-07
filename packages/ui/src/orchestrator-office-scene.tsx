import type { OfficeStationLabels } from "./orchestrator-office-copy";
import { OrchestratorOfficeMap } from "./orchestrator-office-map";
import {
  slotFor,
  specialistAgent,
  type OfficeAgent,
} from "./orchestrator-office-scene-data";
import type { SpecialistId } from "./orchestrator-office-teams";

export function OrchestratorOfficeScene({
  orchestratorLabel,
  stationLabels,
  specialistLabels,
  specialists,
  stage,
}: {
  readonly orchestratorLabel: string;
  readonly stationLabels: OfficeStationLabels;
  readonly specialistLabels: Record<SpecialistId, string>;
  readonly specialists: readonly SpecialistId[];
  readonly stage: string;
}) {
  const agents: readonly OfficeAgent[] = [
    {
      id: "orchestrator",
      isLead: true,
      label: orchestratorLabel,
      role: stage,
      shortLabel: "O",
      station: stationLabels.command_table,
      testId: "orchestrator-node",
      toneClass: "pixel-agent--lead",
      x: 600,
      y: 438,
      slotClass: "pixel-agent--lead-slot",
      routeClass: "pixel-agent--lead-route",
    },
    ...specialists.map((specialist, index) =>
      specialistAgent(
        specialist,
        index,
        specialistLabels[specialist],
        stationLabels,
      ),
    ),
  ];
  const deskSlots = specialists.map((_, index) =>
    slotFor(index, stationLabels),
  );

  return (
    <div
      aria-label={`${orchestratorLabel}: ${stage}`}
      className="orchestrator-office__scene pixel-office"
      data-testid="orchestrator-office-scene"
      role="img"
    >
      <div className="pixel-office__status-strip" aria-hidden="true">
        <span className="pixel-office__brand">PLUTUS OFFICE</span>
        <span>{stage}</span>
      </div>
      <OrchestratorOfficeMap agents={agents} deskSlots={deskSlots} />
    </div>
  );
}

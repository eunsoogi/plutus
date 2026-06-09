import { officeCopy } from "./orchestrator-office-copy";
import {
  specialistAgent,
  type AgentTone,
  type OfficeAgent,
} from "./orchestrator-office-scene-data";
import type { SpecialistId } from "./orchestrator-office-teams";
import { pointPosition } from "./orchestrator-office-three-scene-geometry";
import type { OfficeThreeAgentObject } from "./orchestrator-office-three-types";

function agentColor(tone: AgentTone): string {
  switch (tone) {
    case "amber":
      return "#e7bc54";
    case "blue":
      return "#7fa0dc";
    case "cyan":
      return "#56b7c9";
    case "green":
      return "#75bf88";
    case "lead":
      return "#64d1c8";
    case "lilac":
    case "violet":
      return "#ad8ad9";
    case "mint":
      return "#70c9aa";
    case "rose":
      return "#d98a99";
  }
}

export function officeAgents(
  specialists: readonly SpecialistId[],
  labels: typeof officeCopy.en,
  stage: string,
): readonly OfficeAgent[] {
  return [
    {
      id: "orchestrator",
      isLead: true,
      label: labels.orchestrator,
      role: stage,
      shortLabel: "O",
      station: labels.station.command_table,
      testId: "orchestrator-node",
      tile: { x: 5.22, y: 4.5 },
      tone: "lead",
    },
    ...specialists.map((specialist, index) =>
      specialistAgent(
        specialist,
        index,
        labels.specialist[specialist],
        labels.station,
      ),
    ),
  ];
}

export function agentObjects(
  agents: readonly OfficeAgent[],
): readonly OfficeThreeAgentObject[] {
  return agents.map((agent) => ({
    color: agentColor(agent.tone),
    id: `agent:${agent.id}`,
    kind: "agent",
    label: agent.label,
    position: pointPosition(agent.tile, agent.isLead === true ? 0.34 : 0.28),
    radius: agent.isLead === true ? 0.34 : 0.28,
    role: agent.isLead === true ? agent.role : agent.station,
  }));
}

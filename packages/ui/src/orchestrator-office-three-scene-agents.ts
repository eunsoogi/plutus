import { officeCopy } from "./orchestrator-office-copy";
import {
  specialistAgent,
  type AgentTone,
  type OfficeAgent,
} from "./orchestrator-office-scene-data";
import type { SpecialistId } from "./orchestrator-office-teams";
import {
  pointPosition,
  vector3,
} from "./orchestrator-office-three-scene-geometry";
import type {
  OfficeThreeAgentObject,
  OfficeThreeAmenityObject,
} from "./orchestrator-office-three-types";

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
    modelRole: "agent-head",
    position: pointPosition(agent.tile, agent.isLead === true ? 0.34 : 0.28),
    radius: agent.isLead === true ? 0.34 : 0.28,
    role: agent.isLead === true ? agent.role : agent.station,
    shape: "sphere",
  }));
}

export function agentDetailObjects(
  agents: readonly OfficeAgent[],
): readonly OfficeThreeAmenityObject[] {
  return agents.flatMap((agent) => {
    const radius = agent.isLead === true ? 0.34 : 0.28;
    const center = pointPosition(agent.tile, 0.18);
    return [
      {
        color: agentColor(agent.tone),
        id: `agent-detail:${agent.id}:body`,
        kind: "amenity",
        label: `${agent.label} body`,
        modelRole: "agent-body",
        opacity: 0.92,
        position: center,
        scale: vector3(radius * 1.12, 0.36, radius * 0.82),
        shape: "cylinder",
      },
      {
        color: "#1f2937",
        id: `agent-detail:${agent.id}:left-leg`,
        kind: "amenity",
        label: `${agent.label} left leg`,
        modelRole: "agent-leg",
        position: vector3(center[0] - radius * 0.22, 0.04, center[2]),
        scale: vector3(radius * 0.18, 0.12, radius * 0.18),
      },
      {
        color: "#1f2937",
        id: `agent-detail:${agent.id}:right-leg`,
        kind: "amenity",
        label: `${agent.label} right leg`,
        modelRole: "agent-leg",
        position: vector3(center[0] + radius * 0.22, 0.04, center[2]),
        scale: vector3(radius * 0.18, 0.12, radius * 0.18),
      },
      {
        color: "#f8fafc",
        id: `agent-detail:${agent.id}:badge`,
        kind: "amenity",
        label: `${agent.label} badge`,
        modelRole: "agent-badge",
        position: vector3(center[0], 0.25, center[2] + radius * 0.38),
        scale: vector3(radius * 0.34, 0.1, 0.02),
      },
    ] satisfies readonly OfficeThreeAmenityObject[];
  });
}

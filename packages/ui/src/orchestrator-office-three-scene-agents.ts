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
import { officeThreeAgentTile } from "./orchestrator-office-three-scene-data";
import type {
  OfficeThreeAgentObject,
  OfficeThreeAmenityObject,
} from "./orchestrator-office-three-types";

const agentHeadColor = "#f2c9a7";
const leadAgentHeadRadius = 0.15;
const specialistAgentHeadRadius = 0.13;
const leadAgentBodyRadius = 0.36;
const specialistAgentBodyRadius = 0.3;
const agentBodyCenterY = 0.24;
const leadAgentBodyHeight = 0.44;
const specialistAgentBodyHeight = 0.38;
const agentPoseProfiles = [
  { armForward: 0.05, leftArmTilt: -0.28, rightArmTilt: 0.28 },
  { armForward: -0.02, leftArmTilt: -0.18, rightArmTilt: 0.38 },
  { armForward: 0.09, leftArmTilt: -0.42, rightArmTilt: 0.18 },
  { armForward: 0.02, leftArmTilt: -0.34, rightArmTilt: 0.34 },
  { armForward: -0.06, leftArmTilt: -0.22, rightArmTilt: 0.44 },
] as const;

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

function agentHeadRadius(agent: OfficeAgent): number {
  return agent.isLead === true
    ? leadAgentHeadRadius
    : specialistAgentHeadRadius;
}

function agentBodyRadius(agent: OfficeAgent): number {
  return agent.isLead === true
    ? leadAgentBodyRadius
    : specialistAgentBodyRadius;
}

function agentBodyHeight(agent: OfficeAgent): number {
  return agent.isLead === true
    ? leadAgentBodyHeight
    : specialistAgentBodyHeight;
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
      tile: { x: 4.78, y: 5.08 },
      tone: "lead",
    },
    ...specialists.map((specialist, index) => ({
      ...specialistAgent(
        specialist,
        index,
        labels.specialist[specialist],
        labels.station,
      ),
      tile: officeThreeAgentTile(index),
    })),
  ];
}

export function agentObjects(
  agents: readonly OfficeAgent[],
): readonly OfficeThreeAgentObject[] {
  return agents.map((agent) => {
    const radius = agentHeadRadius(agent);
    const bodyHeight = agentBodyHeight(agent);
    return {
      color: agentHeadColor,
      id: `agent:${agent.id}`,
      kind: "agent",
      label: agent.label,
      modelRole: "agent-head",
      position: pointPosition(agent.tile, agentBodyCenterY + bodyHeight / 2),
      radius,
      role: agent.isLead === true ? agent.role : agent.station,
      shape: "sphere",
    };
  });
}

export function agentDetailObjects(
  agents: readonly OfficeAgent[],
): readonly OfficeThreeAmenityObject[] {
  return agents.flatMap((agent, index) => {
    const bodyRadius = agentBodyRadius(agent);
    const bodyHeight = agentBodyHeight(agent);
    const center = pointPosition(agent.tile, agentBodyCenterY);
    const pose =
      agentPoseProfiles[index % agentPoseProfiles.length] ??
      agentPoseProfiles[0];
    return [
      {
        color: agentColor(agent.tone),
        id: `agent-detail:${agent.id}:body`,
        kind: "amenity",
        label: `${agent.label} body`,
        modelRole: "agent-body",
        opacity: 0.92,
        position: center,
        scale: vector3(bodyRadius * 1.18, bodyHeight, bodyRadius * 0.74),
        shape: "cylinder",
      },
      {
        color: "#1f2937",
        id: `agent-detail:${agent.id}:left-leg`,
        kind: "amenity",
        label: `${agent.label} left leg`,
        modelRole: "agent-leg",
        position: vector3(center[0] - bodyRadius * 0.26, 0.08, center[2]),
        scale: vector3(bodyRadius * 0.2, 0.14, bodyRadius * 0.2),
      },
      {
        color: "#111827",
        id: `agent-detail:${agent.id}:left-foot`,
        kind: "amenity",
        label: `${agent.label} left foot`,
        modelRole: "agent-foot",
        position: vector3(
          center[0] - bodyRadius * 0.28,
          0.035,
          center[2] + bodyRadius * 0.12,
        ),
        scale: vector3(bodyRadius * 0.24, 0.07, bodyRadius * 0.36),
      },
      {
        color: "#1f2937",
        id: `agent-detail:${agent.id}:right-leg`,
        kind: "amenity",
        label: `${agent.label} right leg`,
        modelRole: "agent-leg",
        position: vector3(center[0] + bodyRadius * 0.26, 0.08, center[2]),
        scale: vector3(bodyRadius * 0.2, 0.14, bodyRadius * 0.2),
      },
      {
        color: "#111827",
        id: `agent-detail:${agent.id}:right-foot`,
        kind: "amenity",
        label: `${agent.label} right foot`,
        modelRole: "agent-foot",
        position: vector3(
          center[0] + bodyRadius * 0.28,
          0.035,
          center[2] + bodyRadius * 0.12,
        ),
        scale: vector3(bodyRadius * 0.24, 0.07, bodyRadius * 0.36),
      },
      {
        color: agentColor(agent.tone),
        id: `agent-detail:${agent.id}:left-arm`,
        kind: "amenity",
        label: `${agent.label} left arm`,
        modelRole: "agent-arm",
        position: vector3(
          center[0] - bodyRadius * 0.48,
          center[1] + bodyHeight * 0.08,
          center[2] + bodyRadius * pose.armForward,
        ),
        rotation: vector3(0.08, 0, pose.leftArmTilt),
        scale: vector3(bodyRadius * 0.16, bodyHeight * 0.58, bodyRadius * 0.16),
      },
      {
        color: agentColor(agent.tone),
        id: `agent-detail:${agent.id}:right-arm`,
        kind: "amenity",
        label: `${agent.label} right arm`,
        modelRole: "agent-arm",
        position: vector3(
          center[0] + bodyRadius * 0.48,
          center[1] + bodyHeight * 0.08,
          center[2] - bodyRadius * pose.armForward,
        ),
        rotation: vector3(-0.08, 0, pose.rightArmTilt),
        scale: vector3(bodyRadius * 0.16, bodyHeight * 0.58, bodyRadius * 0.16),
      },
      {
        color: "#f8fafc",
        id: `agent-detail:${agent.id}:badge`,
        kind: "amenity",
        label: `${agent.label} badge`,
        modelRole: "agent-badge",
        position: vector3(
          center[0],
          center[1] + bodyHeight * 0.1,
          center[2] + bodyRadius * 0.36,
        ),
        scale: vector3(bodyRadius * 0.36, bodyHeight * 0.28, 0.02),
      },
      {
        color: "#0b0f19",
        id: `agent-detail:${agent.id}:contact-pad`,
        kind: "amenity",
        label: `${agent.label} contact pad`,
        modelRole: "contact-pad",
        opacity: 0.22,
        position: vector3(center[0], 0.011, center[2]),
        scale: vector3(bodyRadius * 1.2, 0.022, bodyRadius * 0.86),
        shape: "cylinder",
      },
    ] satisfies readonly OfficeThreeAmenityObject[];
  });
}

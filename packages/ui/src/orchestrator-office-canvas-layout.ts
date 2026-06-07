import {
  officeDepth,
  officeFootprint,
  projectOfficePoint,
} from "./orchestrator-office-canvas-geometry";
import {
  pushDeskCommands,
  pushOfficeFixtureCommands,
} from "./orchestrator-office-canvas-fixtures";
import type {
  OfficeCanvasScene,
  OfficeDrawCommand,
  OfficeRotation,
} from "./orchestrator-office-canvas-types";
import type { AgentTone, OfficeAgent } from "./orchestrator-office-scene-data";

function assertNever(value: never): never {
  throw new Error(`Unhandled agent tone: ${value}`);
}

function stationTone(tone: AgentTone): string {
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
    default:
      return assertNever(tone);
  }
}

function pushCommandTable(
  commands: OfficeDrawCommand[],
  rotation: OfficeRotation,
): void {
  commands.push({
    fill: "#232d37",
    kind: "polygon",
    lineWidth: 2,
    points: officeFootprint(4.08, 3.54, 2.34, 1.24, rotation, 52),
    stroke: "#a7d2ea",
  });
}

function pushAgent(
  commands: OfficeDrawCommand[],
  agent: OfficeAgent,
  rotation: OfficeRotation,
): void {
  const feet = projectOfficePoint(agent.tile, rotation);
  const fill = stationTone(agent.tone);

  commands.push({
    at: feet,
    fill,
    isLead: agent.isLead === true,
    kind: "agent",
    shortLabel: agent.shortLabel,
  });
  commands.push({
    accent: fill,
    at: { x: feet.x, y: feet.y - (agent.isLead === true ? 186 : 102) },
    isLead: agent.isLead === true,
    kind: "nameplate",
    label: agent.label,
    shortLabel: agent.shortLabel,
    station: agent.isLead === true ? agent.role : agent.station,
  });
}

function pushAgents(
  commands: OfficeDrawCommand[],
  scene: OfficeCanvasScene,
): void {
  const agents = [...scene.agents].sort(
    (left, right) =>
      officeDepth(left.tile, scene.rotation) -
      officeDepth(right.tile, scene.rotation),
  );
  for (const agent of agents) {
    pushAgent(commands, agent, scene.rotation);
  }
}

function pushDesks(
  commands: OfficeDrawCommand[],
  scene: OfficeCanvasScene,
): void {
  const desks = [...scene.deskSlots].sort(
    (left, right) =>
      officeDepth(left.deskTile, scene.rotation) -
      officeDepth(right.deskTile, scene.rotation),
  );
  for (const desk of desks) {
    pushDeskCommands(commands, desk, scene.rotation);
  }
}

export function buildOfficeDrawCommands(
  scene: OfficeCanvasScene,
): readonly OfficeDrawCommand[] {
  const commands: OfficeDrawCommand[] = [];
  pushOfficeFixtureCommands(commands, scene.rotation);
  pushDesks(commands, scene);
  pushCommandTable(commands, scene.rotation);
  pushAgents(commands, scene);

  return commands;
}

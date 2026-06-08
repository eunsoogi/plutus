import {
  officeDepth,
  officeFootprint,
  officeYawForRotation,
  projectOfficePoint,
} from "./orchestrator-office-canvas-geometry";
import {
  pushDeskCommands,
  pushOfficeFixtureCommands,
} from "./orchestrator-office-canvas-fixtures";
import { officeNameplateFrame } from "./orchestrator-office-canvas-nameplates";
import type {
  OfficeCanvasAgentCommand,
  OfficeCanvasNameplateCommand,
  OfficeCanvasViewport,
  OfficeCanvasScene,
  OfficeDrawCommand,
  OfficeProjection,
} from "./orchestrator-office-canvas-types";
import type { AgentTone, OfficeAgent } from "./orchestrator-office-scene-data";

type NameplateBounds = {
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
  readonly top: number;
};

const DESKTOP_NAMEPLATE_COLLISION_VIEWPORT = {
  height: 760,
  width: 1200,
} satisfies OfficeCanvasViewport;
const MOBILE_NAMEPLATE_COLLISION_VIEWPORT = {
  height: 500,
  width: 390,
} satisfies OfficeCanvasViewport;
const NAMEPLATE_COLLISION_GUTTER = 8;
const NAMEPLATE_COLLISION_MAX_STEPS = 16;

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
  projection: OfficeProjection,
): void {
  commands.push({
    fill: "#232d37",
    kind: "polygon",
    lineWidth: 2,
    points: officeFootprint(4.08, 3.54, 2.34, 1.24, projection, 52),
    stroke: "#a7d2ea",
  });
}

function officeProjectionForScene(scene: OfficeCanvasScene): OfficeProjection {
  const yaw = scene.angle ?? officeYawForRotation(scene.rotation);

  return scene.pitch === undefined ? yaw : { pitch: scene.pitch, yaw };
}

function nameplateBounds(
  command: OfficeCanvasNameplateCommand,
): NameplateBounds {
  const desktopFrame = officeNameplateFrame(
    command,
    DESKTOP_NAMEPLATE_COLLISION_VIEWPORT,
  );
  const mobileFrame = officeNameplateFrame(
    command,
    MOBILE_NAMEPLATE_COLLISION_VIEWPORT,
  );

  return {
    bottom: Math.max(
      desktopFrame.y + desktopFrame.height,
      mobileFrame.y + mobileFrame.height,
    ),
    left: Math.min(desktopFrame.x, mobileFrame.x),
    right: Math.max(
      desktopFrame.x + desktopFrame.width,
      mobileFrame.x + mobileFrame.width,
    ),
    top: Math.min(desktopFrame.y, mobileFrame.y),
  };
}

function boundsIntersect(
  left: NameplateBounds,
  right: NameplateBounds,
): boolean {
  return (
    left.left < right.right &&
    left.right > right.left &&
    left.top < right.bottom &&
    left.bottom > right.top
  );
}

function shiftNameplate(
  command: OfficeCanvasNameplateCommand,
  offsetY: number,
): OfficeCanvasNameplateCommand {
  return {
    ...command,
    at: { x: command.at.x, y: command.at.y + offsetY },
  };
}

function avoidNameplateOverlaps(
  command: OfficeCanvasNameplateCommand,
  placedNameplates: readonly OfficeCanvasNameplateCommand[],
): OfficeCanvasNameplateCommand {
  let candidate = command;

  for (let step = 0; step < NAMEPLATE_COLLISION_MAX_STEPS; step += 1) {
    const candidateBounds = nameplateBounds(candidate);
    const collision = placedNameplates.find((placedNameplate) =>
      boundsIntersect(candidateBounds, nameplateBounds(placedNameplate)),
    );

    if (!collision) {
      return candidate;
    }

    const collisionBounds = nameplateBounds(collision);
    candidate = shiftNameplate(
      candidate,
      collisionBounds.bottom - candidateBounds.top + NAMEPLATE_COLLISION_GUTTER,
    );
  }

  return candidate;
}

function agentCommands(
  agent: OfficeAgent,
  projection: OfficeProjection,
): {
  readonly agent: OfficeCanvasAgentCommand;
  readonly nameplate: OfficeCanvasNameplateCommand;
} {
  const feet = projectOfficePoint(agent.tile, projection);
  const fill = stationTone(agent.tone);

  return {
    agent: {
      at: feet,
      fill,
      isLead: agent.isLead === true,
      kind: "agent",
      shortLabel: agent.shortLabel,
    },
    nameplate: {
      accent: fill,
      at: { x: feet.x, y: feet.y - (agent.isLead === true ? 186 : 102) },
      isLead: agent.isLead === true,
      kind: "nameplate",
      label: agent.label,
      shortLabel: agent.shortLabel,
      station: agent.isLead === true ? agent.role : agent.station,
    },
  };
}

function pushAgents(
  commands: OfficeDrawCommand[],
  scene: OfficeCanvasScene,
): void {
  const projection = officeProjectionForScene(scene);
  const agents = [...scene.agents].sort(
    (left, right) =>
      officeDepth(left.tile, projection) - officeDepth(right.tile, projection),
  );
  const placedNameplates: OfficeCanvasNameplateCommand[] = [];

  for (const agent of agents) {
    const commandPair = agentCommands(agent, projection);
    const nameplate = avoidNameplateOverlaps(
      commandPair.nameplate,
      placedNameplates,
    );

    commands.push(commandPair.agent, nameplate);
    placedNameplates.push(nameplate);
  }
}

function pushDesks(
  commands: OfficeDrawCommand[],
  scene: OfficeCanvasScene,
): void {
  const projection = officeProjectionForScene(scene);
  const desks = [...scene.deskSlots].sort(
    (left, right) =>
      officeDepth(left.deskTile, projection) -
      officeDepth(right.deskTile, projection),
  );
  for (const [deskIndex, desk] of desks.entries()) {
    pushDeskCommands(commands, desk, projection, deskIndex);
  }
}

export function buildOfficeDrawCommands(
  scene: OfficeCanvasScene,
): readonly OfficeDrawCommand[] {
  const commands: OfficeDrawCommand[] = [];
  const projection = officeProjectionForScene(scene);
  pushOfficeFixtureCommands(commands, projection);
  pushDesks(commands, scene);
  pushCommandTable(commands, projection);
  pushAgents(commands, scene);

  return commands;
}

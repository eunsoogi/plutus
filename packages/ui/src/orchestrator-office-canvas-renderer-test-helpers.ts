import { officeCopy } from "./orchestrator-office-copy";
import { buildOfficeDrawCommands } from "./orchestrator-office-canvas-layout";
import { officeNameplateFrame } from "./orchestrator-office-canvas-nameplates";
import { officeRenderTransform } from "./orchestrator-office-canvas-render-frame";
import type {
  OfficeCanvasNameplateCommand,
  OfficeCanvasPoint,
  OfficeCanvasViewport,
  OfficeDrawCommand,
  OfficeRotation,
} from "./orchestrator-office-canvas-types";
import { slotFor, type OfficeAgent } from "./orchestrator-office-scene-data";
import {
  defaultTeam,
  orderedTeamIds,
  teamSpecialists,
  type TeamId,
} from "./orchestrator-office-teams";

export type Bounds = {
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
  readonly top: number;
};

export type Frame = {
  readonly height: number;
  readonly width: number;
  readonly x: number;
  readonly y: number;
};

export const officeRotations = [
  "south-east",
  "south-west",
  "north-west",
  "north-east",
] satisfies readonly OfficeRotation[];

export const mobileNameplateCases = orderedTeamIds.flatMap((teamId) =>
  officeRotations.map((rotation) => ({ rotation, teamId })),
);

export function nameplateCommands(
  teamId: TeamId = defaultTeam,
  rotation: OfficeRotation = "south-east",
): readonly OfficeCanvasNameplateCommand[] {
  const englishOffice = officeCopy.en;
  const specialists = teamSpecialists[teamId];
  const agents: readonly OfficeAgent[] = [
    {
      id: "orchestrator",
      isLead: true,
      label: englishOffice.orchestrator,
      role: englishOffice.stage.completed,
      shortLabel: "O",
      station: englishOffice.station.command_table,
      testId: "orchestrator-node",
      tile: { x: 5.22, y: 4.5 },
      tone: "lead",
    },
    ...specialists.map((specialist, index) => ({
      id: specialist,
      isLead: false,
      label: englishOffice.specialist[specialist],
      role: "Specialist",
      shortLabel: specialist.slice(0, 2).toUpperCase(),
      station: slotFor(index, englishOffice.station).station,
      testId: specialist,
      tile: slotFor(index, englishOffice.station).agentTile,
      tone: "cyan" as const,
    })),
  ];

  return buildOfficeDrawCommands({
    agents,
    deskSlots: specialists.map((_, index) =>
      slotFor(index, englishOffice.station),
    ),
    rotation,
  }).filter(
    (command): command is OfficeCanvasNameplateCommand =>
      command.kind === "nameplate",
  );
}

export function frameBounds(frame: Frame): Bounds {
  return {
    bottom: frame.y + frame.height,
    left: frame.x,
    right: frame.x + frame.width,
    top: frame.y,
  };
}

export function boundsFor(points: readonly OfficeCanvasPoint[]): Bounds {
  return {
    bottom: Math.max(...points.map((point) => point.y)),
    left: Math.min(...points.map((point) => point.x)),
    right: Math.max(...points.map((point) => point.x)),
    top: Math.min(...points.map((point) => point.y)),
  };
}

export function renderedFrameBounds(
  frame: Frame,
  viewport: OfficeCanvasViewport,
): Bounds {
  return renderedBounds(frameBounds(frame), viewport);
}

export function renderedBounds(
  bounds: Bounds,
  viewport: OfficeCanvasViewport,
): Bounds {
  const { offsetX, offsetY, scale } = officeRenderTransform(viewport);
  return {
    bottom: bounds.bottom * scale + offsetY,
    left: bounds.left * scale + offsetX,
    right: bounds.right * scale + offsetX,
    top: bounds.top * scale + offsetY,
  };
}

export function polygonPoints(
  commands: readonly OfficeDrawCommand[],
): readonly OfficeCanvasPoint[] {
  return commands.flatMap((command) =>
    command.kind === "polygon" &&
    command.stroke !== "#6d4b4d" &&
    command.stroke !== "#5e626b" &&
    command.stroke !== "#7d9aad"
      ? command.points
      : [],
  );
}

export function defaultOfficeSceneCommands(): readonly OfficeDrawCommand[] {
  const englishOffice = officeCopy.en;
  const specialists = teamSpecialists[defaultTeam];
  return buildOfficeDrawCommands({
    agents: [],
    angle: 0,
    deskSlots: specialists.map((_, index) =>
      slotFor(index, englishOffice.station),
    ),
    pitch: 58,
    rotation: "south-east",
  });
}

export function expectNoOverlappingFrames(
  frames: readonly Frame[],
  expectFn: (value: boolean) => { toBe: (expected: boolean) => void },
): void {
  for (const [index, frame] of frames.entries()) {
    const bounds = frameBounds(frame);
    for (const laterFrame of frames.slice(index + 1)) {
      expectFn(intersects(bounds, frameBounds(laterFrame))).toBe(false);
    }
  }
}

export function expectRenderedFramesStayInsideViewportGutter(
  frames: readonly Frame[],
  viewport: OfficeCanvasViewport,
  gutter: number,
  expectFn: (value: number) => {
    toBeGreaterThanOrEqual: (expected: number) => void;
    toBeLessThanOrEqual: (expected: number) => void;
  },
): void {
  for (const frame of frames) {
    const bounds = renderedFrameBounds(frame, viewport);
    expectFn(bounds.left).toBeGreaterThanOrEqual(gutter);
    expectFn(bounds.right).toBeLessThanOrEqual(viewport.width - gutter);
    expectFn(bounds.top).toBeGreaterThanOrEqual(gutter);
    expectFn(bounds.bottom).toBeLessThanOrEqual(viewport.height - gutter);
  }
}

function intersects(left: Bounds, right: Bounds): boolean {
  return (
    left.left < right.right &&
    left.right > right.left &&
    left.top < right.bottom &&
    left.bottom > right.top
  );
}

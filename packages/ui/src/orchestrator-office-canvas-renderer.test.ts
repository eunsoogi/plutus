import { describe, expect, it } from "vitest";
import { officeCopy } from "./orchestrator-office-copy";
import { buildOfficeDrawCommands } from "./orchestrator-office-canvas-layout";
import { officeNameplateFrame } from "./orchestrator-office-canvas-nameplates";
import { officeRenderTransform } from "./orchestrator-office-canvas-render-frame";
import type {
  OfficeCanvasPoint,
  OfficeCanvasNameplateCommand,
  OfficeDrawCommand,
  OfficeRotation,
  OfficeCanvasViewport,
} from "./orchestrator-office-canvas-types";
import { slotFor, type OfficeAgent } from "./orchestrator-office-scene-data";
import {
  defaultTeam,
  orderedTeamIds,
  type TeamId,
  teamSpecialists,
} from "./orchestrator-office-teams";

type Bounds = {
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
  readonly top: number;
};

type Frame = {
  readonly height: number;
  readonly width: number;
  readonly x: number;
  readonly y: number;
};

const mobileViewport = {
  height: 500,
  width: 390,
} satisfies OfficeCanvasViewport;

const desktopViewport = {
  height: 760,
  width: 1200,
} satisfies OfficeCanvasViewport;

const mobileCompactCssSize = { height: 36, width: 58 } as const;
const mobileViewportGutter = 8;
const desktopSceneGutter = 16;

const officeRotations = [
  "south-east",
  "south-west",
  "north-west",
  "north-east",
] satisfies readonly OfficeRotation[];

const mobileNameplateCases = orderedTeamIds.flatMap((teamId) =>
  officeRotations.map((rotation) => ({ rotation, teamId })),
);

function intersects(left: Bounds, right: Bounds): boolean {
  return (
    left.left < right.right &&
    left.right > right.left &&
    left.top < right.bottom &&
    left.bottom > right.top
  );
}

function nameplateCommands(
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

function frameBounds(frame: Frame): Bounds {
  return {
    bottom: frame.y + frame.height,
    left: frame.x,
    right: frame.x + frame.width,
    top: frame.y,
  };
}

function boundsFor(points: readonly OfficeCanvasPoint[]): Bounds {
  return {
    bottom: Math.max(...points.map((point) => point.y)),
    left: Math.min(...points.map((point) => point.x)),
    right: Math.max(...points.map((point) => point.x)),
    top: Math.min(...points.map((point) => point.y)),
  };
}

function renderedFrameBounds(frame: Frame, viewport: OfficeCanvasViewport): Bounds {
  return renderedBounds(frameBounds(frame), viewport);
}

function renderedBounds(
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

function polygonPoints(
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

function defaultOfficeSceneCommands(): readonly OfficeDrawCommand[] {
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

function expectNoOverlappingFrames(frames: readonly Frame[]): void {
  for (const [index, frame] of frames.entries()) {
    const bounds = frameBounds(frame);
    for (const laterFrame of frames.slice(index + 1)) {
      expect(intersects(bounds, frameBounds(laterFrame))).toBe(false);
    }
  }
}

function expectRenderedFramesStayInsideViewportGutter(
  frames: readonly Frame[],
  viewport: OfficeCanvasViewport,
  gutter: number,
): void {
  for (const frame of frames) {
    const bounds = renderedFrameBounds(frame, viewport);

    expect(bounds.left).toBeGreaterThanOrEqual(gutter);
    expect(bounds.right).toBeLessThanOrEqual(viewport.width - gutter);
    expect(bounds.top).toBeGreaterThanOrEqual(gutter);
    expect(bounds.bottom).toBeLessThanOrEqual(viewport.height - gutter);
  }
}

describe("officeNameplateFrame", () => {
  it("keeps max-pitch office geometry inside the desktop render frame", () => {
    const renderedSceneBounds = renderedBounds(
      boundsFor(polygonPoints(defaultOfficeSceneCommands())),
      desktopViewport,
    );

    expect(renderedSceneBounds.left).toBeGreaterThanOrEqual(desktopSceneGutter);
    expect(renderedSceneBounds.right).toBeLessThanOrEqual(
      desktopViewport.width - desktopSceneGutter,
    );
    expect(renderedSceneBounds.top).toBeGreaterThanOrEqual(desktopSceneGutter);
    expect(renderedSceneBounds.bottom).toBeLessThanOrEqual(
      desktopViewport.height - desktopSceneGutter,
    );
  });

  it("keeps desktop render scale near normal size", () => {
    expect(officeRenderTransform(desktopViewport).scale).toBeGreaterThanOrEqual(
      0.95,
    );
  });

  it("keeps desktop canvas nameplates in full card mode", () => {
    const frames = nameplateCommands().map((command) =>
      officeNameplateFrame(command, desktopViewport),
    );

    expect(frames.every((frame) => frame.mode === "full")).toBe(true);
  });

  it.each(officeRotations)(
    "keeps default desktop canvas nameplates non-overlapping in %s rotation",
    (rotation) => {
      const frames = nameplateCommands(defaultTeam, rotation).map((command) =>
        officeNameplateFrame(command, desktopViewport),
      );

      expectNoOverlappingFrames(frames);
    },
  );

  it.each(mobileNameplateCases)(
    "keeps mobile canvas nameplates compact and non-overlapping for $teamId in $rotation",
    ({ rotation, teamId }) => {
      const frames = nameplateCommands(teamId, rotation).map((command) =>
        officeNameplateFrame(command, mobileViewport),
      );

      expect(frames.every((frame) => frame.mode === "compact")).toBe(true);
      expectNoOverlappingFrames(frames);
    },
  );

  it("keeps mobile compact nameplates readable after render scaling", () => {
    const { scale } = officeRenderTransform(mobileViewport);
    const frames = nameplateCommands().map((command) =>
      officeNameplateFrame(command, mobileViewport),
    );

    expect(frames.every((frame) => frame.mode === "compact")).toBe(true);
    for (const frame of frames) {
      expect(frame.width * scale).toBeCloseTo(mobileCompactCssSize.width, 1);
      expect(frame.height * scale).toBeCloseTo(mobileCompactCssSize.height, 1);
    }
    expectNoOverlappingFrames(frames);
  });

  it.each(mobileNameplateCases)(
    "keeps rendered mobile compact nameplates inside the viewport gutter for $teamId in $rotation",
    ({ rotation, teamId }) => {
      const frames = nameplateCommands(teamId, rotation).map((command) =>
        officeNameplateFrame(command, mobileViewport),
      );

      expectRenderedFramesStayInsideViewportGutter(
        frames,
        mobileViewport,
        mobileViewportGutter,
      );
    },
  );

});

import { describe, expect, it } from "vitest";
import { buildOfficeDrawCommands } from "./orchestrator-office-canvas-layout";
import type {
  OfficeCanvasPolygonCommand,
  OfficeDrawCommand,
} from "./orchestrator-office-canvas-types";
import { officeCopy } from "./orchestrator-office-copy";
import { slotFor } from "./orchestrator-office-scene-data";

function readVolumeId(command: OfficeDrawCommand): string | null {
  if ("volumeId" in command && typeof command.volumeId === "string") {
    return command.volumeId;
  }

  return null;
}

function readSurface(command: OfficeDrawCommand): string | null {
  if ("surface" in command && typeof command.surface === "string") {
    return command.surface;
  }

  return null;
}

function expectVolumetricSurfaces(
  commands: readonly OfficeDrawCommand[],
  volumeId: string,
): void {
  const surfaces = new Set(
    commands
      .filter((command) => readVolumeId(command) === volumeId)
      .map((command) => readSurface(command))
      .filter((surface): surface is string => surface !== null),
  );

  expect(surfaces).toEqual(new Set(["shadow", "front", "side", "top"]));
}

function polygonArea(points: OfficeCanvasPolygonCommand["points"]): number {
  const total = points.reduce((sum, point, index) => {
    const nextPoint = points[(index + 1) % points.length];
    return sum + point.x * nextPoint.y - nextPoint.x * point.y;
  }, 0);

  return Math.abs(total) / 2;
}

function polygonSurface(
  commands: readonly OfficeDrawCommand[],
  volumeId: string,
  surface: string,
): OfficeCanvasPolygonCommand {
  const command = commands.find(
    (candidate): candidate is OfficeCanvasPolygonCommand =>
      candidate.kind === "polygon" &&
      readVolumeId(candidate) === volumeId &&
      readSurface(candidate) === surface,
  );

  if (!command) {
    throw new Error(`Missing ${surface} surface for ${volumeId}`);
  }

  return command;
}

describe("orchestrator office canvas volume", () => {
  it("tags desks, furniture, and amenities with volumetric face semantics", () => {
    const commands = buildOfficeDrawCommands({
      agents: [],
      deskSlots: [slotFor(0, officeCopy.en.station)],
      rotation: "south-east",
    });

    expectVolumetricSurfaces(commands, "desk-0");
    expectVolumetricSurfaces(commands, "furniture-0");
    expectVolumetricSurfaces(commands, "amenity-cuboid-0");
  });

  it("gives desk volume measurable side and front faces across pitched yaw", () => {
    const lowPitchCommands = buildOfficeDrawCommands({
      agents: [],
      angle: 37,
      deskSlots: [slotFor(0, officeCopy.en.station)],
      pitch: 28,
      rotation: "south-east",
    });
    const highPitchCommands = buildOfficeDrawCommands({
      agents: [],
      angle: 37,
      deskSlots: [slotFor(0, officeCopy.en.station)],
      pitch: 58,
      rotation: "south-east",
    });

    const highPitchFront = polygonSurface(highPitchCommands, "desk-0", "front");
    const highPitchSide = polygonSurface(highPitchCommands, "desk-0", "side");
    const highPitchTop = polygonSurface(highPitchCommands, "desk-0", "top");
    const lowPitchSide = polygonSurface(lowPitchCommands, "desk-0", "side");

    expect(polygonArea(highPitchFront.points)).toBeGreaterThan(250);
    expect(polygonArea(highPitchSide.points)).toBeGreaterThan(250);
    expect(polygonArea(highPitchTop.points)).toBeGreaterThan(
      polygonArea(highPitchSide.points),
    );
    expect(polygonArea(highPitchSide.points)).toBeGreaterThan(
      polygonArea(lowPitchSide.points) + 40,
    );
    expect(
      highPitchCommands.findIndex((command) => command === highPitchSide),
    ).toBeLessThan(
      highPitchCommands.findIndex((command) => command === highPitchTop),
    );
  });
});

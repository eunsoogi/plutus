import { describe, expect, it } from "vitest";
import { buildOfficeDrawCommands } from "./orchestrator-office-canvas-layout";
import type { OfficeDrawCommand } from "./orchestrator-office-canvas-types";
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
});

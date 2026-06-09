import { describe, expect, it } from "vitest";
import { createOfficeThreeSceneCatalog } from "./orchestrator-office-three-scene";
import type {
  OfficeThreeModelRole,
  OfficeThreeSceneObject,
} from "./orchestrator-office-three-types";

type Footprint = {
  readonly assemblyKey: string;
  readonly id: string;
  readonly maxX: number;
  readonly maxZ: number;
  readonly minX: number;
  readonly minZ: number;
  readonly modelRole?: OfficeThreeModelRole;
};

const checkedRoles = new Set<OfficeThreeModelRole>([
  "agent-body",
  "cabinet-panel",
  "chair-seat",
  "coffee-table-top",
  "desk-surface",
  "planter-pot",
  "report-bench-seat",
  "sofa-arm",
  "sofa-seat",
  "terminal-panel",
]);

const internalDetailRoles = new Set<OfficeThreeModelRole>([
  "cabinet-panel",
  "coffee-table-top",
  "report-bench-seat",
  "sofa-arm",
  "sofa-seat",
  "terminal-panel",
]);

function assemblyKey(object: OfficeThreeSceneObject): string {
  if (object.id.startsWith("furniture-detail:")) {
    return `furniture:${object.id.split(":")[1] ?? object.id}`;
  }
  if (object.id.startsWith("desk-detail:")) {
    return `desk:${object.id.split(":")[1] ?? object.id}`;
  }
  if (object.id.startsWith("agent-detail:")) {
    return `agent:${object.id.split(":")[1] ?? object.id}`;
  }
  return object.id;
}

function hasCheckedFootprint(object: OfficeThreeSceneObject): boolean {
  if (!("scale" in object)) return false;
  if (object.id.startsWith("furniture:")) return true;
  return object.modelRole !== undefined && checkedRoles.has(object.modelRole);
}

function footprintFor(object: OfficeThreeSceneObject): Footprint | undefined {
  if (!hasCheckedFootprint(object) || !("scale" in object)) return undefined;
  return scaledFootprintFor(object);
}

function scaledFootprintFor(
  object: Extract<OfficeThreeSceneObject, { readonly scale: readonly number[] }>,
): Footprint {
  const halfX = object.scale[0] / 2;
  const halfZ = object.scale[2] / 2;
  return {
    assemblyKey: assemblyKey(object),
    id: object.id,
    maxX: object.position[0] + halfX,
    maxZ: object.position[2] + halfZ,
    minX: object.position[0] - halfX,
    minZ: object.position[2] - halfZ,
    modelRole: object.modelRole,
  };
}

function isAllowedInternalOverlap(
  first: Footprint,
  second: Footprint,
): boolean {
  if (first.assemblyKey !== second.assemblyKey) return false;
  return (
    first.id.startsWith("furniture:") ||
    second.id.startsWith("furniture:") ||
    (first.modelRole !== undefined &&
      internalDetailRoles.has(first.modelRole)) ||
    (second.modelRole !== undefined &&
      internalDetailRoles.has(second.modelRole))
  );
}

function overlapArea(first: Footprint, second: Footprint): number {
  const x =
    Math.min(first.maxX, second.maxX) - Math.max(first.minX, second.minX);
  const z =
    Math.min(first.maxZ, second.maxZ) - Math.max(first.minZ, second.minZ);
  return Math.max(0, x) * Math.max(0, z);
}

function checkedFootprints(
  objects: readonly OfficeThreeSceneObject[],
): readonly Footprint[] {
  return objects.flatMap((object) => {
    const footprint = footprintFor(object);
    return footprint === undefined ? [] : [footprint];
  });
}

function findScaledObject(
  objects: readonly OfficeThreeSceneObject[],
  id: string,
): Extract<OfficeThreeSceneObject, { readonly scale: readonly number[] }> {
  const object = objects.find((candidate) => candidate.id === id);
  if (object === undefined || !("scale" in object)) {
    throw new Error(`Missing scaled office Three scene object: ${id}`);
  }
  return object;
}

function isInsideFloorEnvelope(object: Footprint, floor: Footprint): boolean {
  return (
    object.minX >= floor.minX &&
    object.maxX <= floor.maxX &&
    object.minZ >= floor.minZ &&
    object.maxZ <= floor.maxZ
  );
}

describe("office Three.js scene spacing", () => {
  it("keeps unrelated occupied floor-space footprints from overlapping", () => {
    const contract = createOfficeThreeSceneCatalog({
      locale: "en",
      stage: "Executing",
      teamId: "portfolio_review_committee",
    });

    const footprints = checkedFootprints(contract.scene.objects);
    const collisions: readonly string[] = footprints.flatMap((first, index) =>
      footprints.slice(index + 1).flatMap((second) => {
        const area = overlapArea(first, second);
        if (area <= 0.015 || isAllowedInternalOverlap(first, second)) {
          return [];
        }
        return [
          `${first.id} overlaps ${second.id} by ${area.toFixed(3)} floor units`,
        ];
      }),
    );

    expect(collisions).toEqual([]);
    expect(footprints.map((footprint) => footprint.id)).toEqual(
      expect.arrayContaining([
        "agent-detail:orchestrator:body",
        "desk:command_table",
        "desk-detail:command_table:chair-seat",
        "furniture:risk-cabinet",
        "plant:3",
      ]),
    );
    expect(
      new Set(
        footprints
          .filter((footprint) => footprint.id.startsWith("desk-detail:"))
          .map((footprint) => footprint.assemblyKey),
      ).size,
    ).toBeGreaterThan(1);
  });

  it("keeps reference family anchors inside the readable office floor", () => {
    const contract = createOfficeThreeSceneCatalog({
      locale: "en",
      stage: "Executing",
      teamId: "portfolio_review_committee",
    });
    const objects = contract.scene.objects;
    const floor = findScaledObject(objects, "room:floor");
    const floorHalfX = floor.scale[0] / 2;
    const floorHalfZ = floor.scale[2] / 2;
    const floorEnvelope = {
      assemblyKey: floor.id,
      id: floor.id,
      maxX: floor.position[0] + floorHalfX,
      maxZ: floor.position[2] + floorHalfZ,
      minX: floor.position[0] - floorHalfX,
      minZ: floor.position[2] - floorHalfZ,
    } satisfies Footprint;
    const footprints = checkedFootprints(objects);
    const outOfBounds = footprints.flatMap((footprint) => {
      if (isInsideFloorEnvelope(footprint, floorEnvelope)) {
        return [];
      }
      return [`${footprint.id} leaves the floor envelope`];
    });

    expect(outOfBounds).toEqual([]);
    expect(footprints.map((footprint) => footprint.id)).toEqual(
      expect.arrayContaining([
        "desk:command_table",
        "desk-detail:command_table:chair-seat",
        "agent-detail:orchestrator:body",
        "furniture:sofa",
        "furniture:risk-cabinet",
        "plant:0",
      ]),
    );
    const renderedStationCount = footprints.filter(
      (footprint) => footprint.modelRole === "desk-surface",
    ).length;

    expect(renderedStationCount).toBe(5);
    expect(
      footprints.filter((footprint) => footprint.modelRole === "chair-seat"),
    ).toHaveLength(renderedStationCount);
    expect(
      footprints.filter((footprint) => footprint.modelRole === "agent-body"),
    ).toHaveLength(renderedStationCount);
  });

  it("keeps room zoning anchors readable without leaving the cutaway floor", () => {
    const contract = createOfficeThreeSceneCatalog({
      locale: "en",
      stage: "Executing",
      teamId: "portfolio_review_committee",
    });
    const objects = contract.scene.objects;
    const floor = findScaledObject(objects, "room:floor");
    const floorTop = floor.position[1] + floor.scale[1] / 2;
    const floorEnvelope = {
      assemblyKey: floor.id,
      id: floor.id,
      maxX: floor.position[0] + floor.scale[0] / 2,
      maxZ: floor.position[2] + floor.scale[2] / 2,
      minX: floor.position[0] - floor.scale[0] / 2,
      minZ: floor.position[2] - floor.scale[2] / 2,
    } satisfies Footprint;
    const anchorIds = [
      "room-detail:zone:command-rug",
      "room-detail:zone:lounge-rug",
      "room-detail:partition:market",
      "room-detail:partition:risk",
      "room-detail:boundary-wall-0:base-rail",
      "room-detail:boundary-wall-1:base-rail",
    ] as const;

    for (const id of anchorIds) {
      const anchor = findScaledObject(objects, id);
      const footprint = scaledFootprintFor(anchor);

      expect(anchor.scale.every((value) => value > 0)).toBe(true);
      expect(isInsideFloorEnvelope(footprint, floorEnvelope)).toBe(true);
      if (anchor.modelRole === "rug-zone") {
        expect(anchor.position[1] - anchor.scale[1] / 2).toBeGreaterThan(
          floorTop,
        );
      }
    }
  });
});

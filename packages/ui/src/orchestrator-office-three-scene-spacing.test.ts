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

describe("office Three.js scene spacing", () => {
  it("keeps unrelated occupied floor-space footprints from overlapping", () => {
    const contract = createOfficeThreeSceneCatalog({
      locale: "en",
      stage: "Executing",
      teamId: "portfolio_review_committee",
    });

    const footprints = contract.scene.objects.flatMap((object) => {
      const footprint = footprintFor(object);
      return footprint === undefined ? [] : [footprint];
    });
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
});

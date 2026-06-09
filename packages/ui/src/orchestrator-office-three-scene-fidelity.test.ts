import { describe, expect, it } from "vitest";
import { createOfficeThreeSceneCatalog } from "./orchestrator-office-three-scene";
import type { OfficeThreeSceneObject } from "./orchestrator-office-three-types";

function findObject(
  objects: readonly OfficeThreeSceneObject[],
  id: string,
): OfficeThreeSceneObject {
  const object = objects.find((candidate) => candidate.id === id);
  if (!object) {
    throw new Error(`Missing office Three scene object: ${id}`);
  }
  return object;
}

function horizontalDistance(
  first: OfficeThreeSceneObject,
  second: OfficeThreeSceneObject,
): number {
  const x = first.position[0] - second.position[0];
  const z = first.position[2] - second.position[2];
  return Math.hypot(x, z);
}

describe("office Three.js scene fidelity details", () => {
  it("catalogs semantic detail roles that make furniture and agents recognizable", () => {
    const contract = createOfficeThreeSceneCatalog({
      locale: "en",
      stage: "Executing",
      teamId: "portfolio_review_committee",
    });

    const roles = contract.scene.objects.map((object) => object.modelRole);

    expect(roles).toEqual(
      expect.arrayContaining([
        "agent-arm",
        "agent-foot",
        "contact-pad",
        "desk-drawer",
        "desk-edge",
        "sofa-cushion",
        "cabinet-handle",
      ]),
    );
    expect(
      contract.scene.objects.filter(
        (object) => object.modelRole === "desk-edge",
      ).length,
    ).toBeGreaterThanOrEqual(6);
    expect(
      contract.scene.objects.filter(
        (object) => object.modelRole === "agent-arm",
      ).length,
    ).toBeGreaterThanOrEqual(6);
  });

  it("keeps planter foliage attached to its spaced 3D planter base", () => {
    const contract = createOfficeThreeSceneCatalog({
      locale: "en",
      stage: "Executing",
      teamId: "portfolio_review_committee",
    });
    const objects = contract.scene.objects;

    for (const index of [0, 1, 2, 3, 4]) {
      const pot = findObject(objects, `plant:${index}`);
      const leafA = findObject(objects, `plant-detail:${index}:leaf-a`);
      const leafB = findObject(objects, `plant-detail:${index}:leaf-b`);

      expect(horizontalDistance(pot, leafA)).toBeLessThan(0.18);
      expect(horizontalDistance(pot, leafB)).toBeLessThan(0.18);
    }
  });
});

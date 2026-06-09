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

function objectsWithPrefix(
  objects: readonly OfficeThreeSceneObject[],
  prefix: string,
): readonly OfficeThreeSceneObject[] {
  return objects.filter((object) => object.id.startsWith(prefix));
}

function countRole(
  objects: readonly OfficeThreeSceneObject[],
  modelRole: OfficeThreeSceneObject["modelRole"],
): number {
  return objects.filter((object) => object.modelRole === modelRole).length;
}

function scaledObject(
  objects: readonly OfficeThreeSceneObject[],
  id: string,
): Extract<OfficeThreeSceneObject, { readonly scale: readonly number[] }> {
  const object = findObject(objects, id);
  if (!("scale" in object)) {
    throw new Error(`Expected scaled office Three scene object: ${id}`);
  }
  return object;
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
        "chair-leg",
        "desk-drawer",
        "desk-edge",
        "desk-equipment-cluster",
        "desk-inset-panel",
        "desk-leg",
        "desk-lip",
        "desk-surface",
        "chair-back",
        "chair-seat",
        "sofa-cushion",
        "sofa-seat",
        "cabinet-handle",
        "cabinet-shelf",
        "plant-leaf",
        "planter-pot",
        "partition-panel",
        "rug-zone",
        "wall-base-rail",
        "wall-panel",
        "wall-trim",
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

  it("keeps every reference object family identifiable from semantic parts", () => {
    const contract = createOfficeThreeSceneCatalog({
      locale: "en",
      stage: "Executing",
      teamId: "portfolio_review_committee",
    });
    const objects = contract.scene.objects;
    const stationIds = objects
      .filter((object) => object.id.startsWith("desk:"))
      .map((object) => object.id.replace("desk:", ""));
    const agentIds = objectsWithPrefix(objects, "agent:").map((object) =>
      object.id.replace("agent:", ""),
    );
    const sofaIds = ["sofa", "strategy-sofa"] as const;

    expect(stationIds).toHaveLength(5);

    for (const stationId of stationIds) {
      const stationObjects = objects.filter(
        (object) =>
          object.id === `desk:${stationId}` ||
          object.id.startsWith(`desk-detail:${stationId}:`),
      );

      expect(countRole(stationObjects, "desk-surface")).toBe(1);
      expect(countRole(stationObjects, "desk-leg")).toBe(4);
      expect(countRole(stationObjects, "desk-edge")).toBeGreaterThanOrEqual(3);
      expect(countRole(stationObjects, "desk-lip")).toBeGreaterThanOrEqual(2);
      expect(countRole(stationObjects, "desk-inset-panel")).toBe(1);
      expect(countRole(stationObjects, "desk-drawer")).toBe(1);
      expect(countRole(stationObjects, "monitor-screen")).toBe(1);
      expect(countRole(stationObjects, "monitor-stand")).toBe(1);
      expect(countRole(stationObjects, "desk-equipment-cluster")).toBe(2);
      expect(countRole(stationObjects, "chair-seat")).toBe(1);
      expect(countRole(stationObjects, "chair-back")).toBe(1);
      expect(countRole(stationObjects, "chair-leg")).toBe(4);
    }

    for (const agentId of agentIds) {
      const agentObjects = objects.filter(
        (object) =>
          object.id === `agent:${agentId}` ||
          object.id.startsWith(`agent-detail:${agentId}:`),
      );

      expect(countRole(agentObjects, "agent-head")).toBe(1);
      expect(countRole(agentObjects, "agent-body")).toBe(1);
      expect(countRole(agentObjects, "agent-arm")).toBe(2);
      expect(countRole(agentObjects, "agent-foot")).toBe(2);
      expect(countRole(agentObjects, "agent-leg")).toBe(2);
      expect(countRole(agentObjects, "contact-pad")).toBe(1);
    }

    for (const sofaId of sofaIds) {
      const sofaObjects = objects.filter(
        (object) =>
          object.id === `furniture:${sofaId}` ||
          object.id.startsWith(`furniture-detail:${sofaId}:`),
      );

      expect(countRole(sofaObjects, "sofa-seat")).toBe(1);
      expect(countRole(sofaObjects, "sofa-back")).toBe(1);
      expect(countRole(sofaObjects, "sofa-arm")).toBe(2);
      expect(countRole(sofaObjects, "sofa-cushion")).toBe(2);
    }

    const cabinetObjects = objects.filter(
      (object) =>
        object.id === "furniture:risk-cabinet" ||
        object.id.startsWith("furniture-detail:risk-cabinet:"),
    );

    expect(countRole(cabinetObjects, "cabinet-door")).toBe(2);
    expect(countRole(cabinetObjects, "cabinet-handle")).toBe(2);
    expect(countRole(cabinetObjects, "cabinet-shelf")).toBe(1);
    expect(countRole(objects, "plant-leaf")).toBe(
      countRole(objects, "planter-pot") * 3,
    );
    expect(countRole(objects, "rug-zone")).toBeGreaterThanOrEqual(2);
    expect(countRole(objects, "partition-panel")).toBeGreaterThanOrEqual(2);
    expect(countRole(objects, "wall-base-rail")).toBeGreaterThanOrEqual(2);
    expect(countRole(objects, "wall-panel")).toBeGreaterThanOrEqual(4);
    expect(countRole(objects, "wall-trim")).toBeGreaterThanOrEqual(4);
  });

  it("varies agent activity poses without moving agents off their stations", () => {
    const contract = createOfficeThreeSceneCatalog({
      locale: "en",
      stage: "Executing",
      teamId: "portfolio_review_committee",
    });
    const objects = contract.scene.objects;
    const armRotations = objectsWithPrefix(objects, "agent-detail:")
      .filter((object) => object.modelRole === "agent-arm")
      .map((object) => object.rotation?.join(",") ?? "no-rotation");
    const bodyPositions = objectsWithPrefix(objects, "agent-detail:")
      .filter((object) => object.modelRole === "agent-body")
      .map((object) => object.position.join(","));

    expect(new Set(armRotations).size).toBeGreaterThanOrEqual(4);
    expect(new Set(bodyPositions).size).toBe(5);
    expect(bodyPositions).toHaveLength(5);
  });

  it("orients desk lips on the edge that matches station facing", () => {
    const contract = createOfficeThreeSceneCatalog({
      locale: "en",
      stage: "Executing",
      teamId: "portfolio_review_committee",
    });
    const objects = contract.scene.objects;
    const marketDesk = scaledObject(objects, "desk:market_desk");
    const marketFrontLip = scaledObject(
      objects,
      "desk-detail:market_desk:front-lip",
    );
    const marketRearLip = scaledObject(
      objects,
      "desk-detail:market_desk:rear-lip",
    );
    const reportDesk = scaledObject(objects, "desk:report_bay");
    const reportFrontLip = scaledObject(
      objects,
      "desk-detail:report_bay:front-lip",
    );
    const reportRearLip = scaledObject(
      objects,
      "desk-detail:report_bay:rear-lip",
    );

    expect(marketFrontLip.position[0]).toBeGreaterThan(marketDesk.position[0]);
    expect(marketRearLip.position[0]).toBeLessThan(marketDesk.position[0]);
    expect(marketFrontLip.scale[0]).toBeLessThan(marketFrontLip.scale[2]);
    expect(marketRearLip.scale[0]).toBeLessThan(marketRearLip.scale[2]);
    expect(reportFrontLip.position[2]).toBeLessThan(reportDesk.position[2]);
    expect(reportRearLip.position[2]).toBeGreaterThan(reportDesk.position[2]);
    expect(reportFrontLip.scale[2]).toBeLessThan(reportFrontLip.scale[0]);
    expect(reportRearLip.scale[2]).toBeLessThan(reportRearLip.scale[0]);
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
      const leafC = findObject(objects, `plant-detail:${index}:leaf-c`);
      const leafHeights = new Set([
        leafA.position[1],
        leafB.position[1],
        leafC.position[1],
      ]);

      expect(horizontalDistance(pot, leafA)).toBeLessThan(0.18);
      expect(horizontalDistance(pot, leafB)).toBeLessThan(0.18);
      expect(horizontalDistance(pot, leafC)).toBeLessThan(0.18);
      expect(leafHeights.size).toBeGreaterThanOrEqual(2);
    }
  });
});

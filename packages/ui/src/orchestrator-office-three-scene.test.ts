import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { officeCuboids } from "./orchestrator-office-canvas-furnishings";
import { officeFurnitureRects } from "./orchestrator-office-canvas-furniture";
import { officeCopy } from "./orchestrator-office-copy";
import { teamSpecialists, type TeamId } from "./orchestrator-office-teams";
import {
  officeThreeRendererContractVersion,
  type OfficeThreeRendererContract,
  type OfficeThreeSceneObject,
  type OfficeThreeVector3,
} from "./orchestrator-office-three-types";

type SceneCatalogInput = {
  readonly locale?: "en" | "ko";
  readonly stage?: string;
  readonly teamId?: TeamId;
};

type SceneCatalogModule = {
  readonly createOfficeThreeSceneCatalog: (
    input?: SceneCatalogInput,
  ) => OfficeThreeRendererContract;
};

const sceneCatalogModuleUrl = new URL(
  "./orchestrator-office-three-scene.ts",
  import.meta.url,
);

async function loadSceneCatalogModule(): Promise<SceneCatalogModule> {
  expect(existsSync(sceneCatalogModuleUrl)).toBe(true);

  return import("./orchestrator-office-three-scene");
}

function expectVector3(vector: OfficeThreeVector3): void {
  expect(vector).toHaveLength(3);
  for (const coordinate of vector) {
    expect(Number.isFinite(coordinate)).toBe(true);
  }
}

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

function expectScaledMesh(
  object: Extract<
    OfficeThreeSceneObject,
    { readonly scale: OfficeThreeVector3 }
  >,
): void {
  expectVector3(object.position);
  expectVector3(object.scale);
  expect(object.scale.every((value) => value > 0)).toBe(true);
  expect(object.color).toMatch(/^(#|rgb)/);
}

describe("office Three.js scene catalog", () => {
  it("catalogs desks, walls, furniture, and agents as semantic 3D objects", async () => {
    const { createOfficeThreeSceneCatalog } = await loadSceneCatalogModule();

    const contract = createOfficeThreeSceneCatalog({
      locale: "en",
      stage: "Executing",
      teamId: "portfolio_review_committee",
    });
    const objects = contract.scene.objects;
    const desks = objects.filter((object) => object.kind === "desk");
    const walls = objects.filter(
      (object) => object.kind === "room" && object.id.includes("wall"),
    );
    const furniture = objects.filter(
      (object) =>
        object.kind === "amenity" && object.id.startsWith("furniture:"),
    );
    const fixtureCuboids = objects.filter(
      (object) =>
        object.kind === "amenity" && object.id.startsWith("fixture:cuboid"),
    );
    const agents = objects.filter((object) => object.kind === "agent");
    const detailRoles = objects
      .map((object) => object.modelRole)
      .filter((modelRole) => modelRole !== undefined);

    expect(contract.version).toBe(officeThreeRendererContractVersion);
    expect(desks).toHaveLength(
      teamSpecialists.portfolio_review_committee.length + 1,
    );
    expect(walls.length).toBeGreaterThanOrEqual(4);
    expect(furniture).toHaveLength(officeFurnitureRects.length);
    expect(fixtureCuboids).toHaveLength(officeCuboids.length);
    expect(agents).toHaveLength(
      teamSpecialists.portfolio_review_committee.length + 1,
    );
    expect(detailRoles).toEqual(
      expect.arrayContaining([
        "agent-badge",
        "agent-body",
        "agent-head",
        "agent-leg",
        "cabinet-body",
        "cabinet-door",
        "cabinet-panel",
        "cabinet-shelf",
        "chair-back",
        "chair-seat",
        "coffee-table-leg",
        "coffee-table-top",
        "desk-leg",
        "desk-surface",
        "monitor-screen",
        "monitor-stand",
        "plant-leaf",
        "planter-pot",
        "report-bench-leg",
        "report-bench-seat",
        "sofa-arm",
        "sofa-back",
        "sofa-cushion",
        "sofa-seat",
        "terminal-panel",
        "terminal-screen",
        "wall-trim",
      ]),
    );

    const commandDesk = findObject(objects, "desk:command_table");
    expect(commandDesk.kind).toBe("desk");
    if (commandDesk.kind !== "desk") return;
    expect(commandDesk.label).toBe(officeCopy.en.station.command_table);
    expect(commandDesk.stationId).toBe("command_table");
    expect(commandDesk.modelRole).toBe("desk-surface");
    expectScaledMesh(commandDesk);

    const glassWall = findObject(objects, "room:glass-wall-0");
    expect(glassWall.kind).toBe("room");
    if (glassWall.kind !== "room") return;
    expect(glassWall.opacity).toBeLessThan(1);
    expectScaledMesh(glassWall);

    const sofa = findObject(objects, "furniture:sofa");
    expect(sofa.kind).toBe("amenity");
    if (sofa.kind !== "amenity") return;
    expect(sofa.label).toBe("Sofa");
    expectScaledMesh(sofa);

    const sofaBack = findObject(objects, "furniture-detail:sofa:back");
    expect(sofaBack.kind).toBe("amenity");
    if (sofaBack.kind !== "amenity") return;
    expect(sofaBack.modelRole).toBe("sofa-back");
    expectScaledMesh(sofaBack);

    const coffeeTableLeg = findObject(
      objects,
      "furniture-detail:coffee-table:leg-1",
    );
    expect(coffeeTableLeg.kind).toBe("amenity");
    if (coffeeTableLeg.kind !== "amenity") return;
    expect(coffeeTableLeg.modelRole).toBe("coffee-table-leg");
    expectScaledMesh(coffeeTableLeg);

    const marketTerminalScreen = findObject(
      objects,
      "furniture-detail:market-terminal:screen",
    );
    expect(marketTerminalScreen.kind).toBe("amenity");
    if (marketTerminalScreen.kind !== "amenity") return;
    expect(marketTerminalScreen.modelRole).toBe("terminal-screen");
    expectScaledMesh(marketTerminalScreen);

    const reportBenchSeat = findObject(
      objects,
      "furniture-detail:report-bench:seat",
    );
    expect(reportBenchSeat.kind).toBe("amenity");
    if (reportBenchSeat.kind !== "amenity") return;
    expect(reportBenchSeat.modelRole).toBe("report-bench-seat");
    expectScaledMesh(reportBenchSeat);

    const riskCabinetDoor = findObject(
      objects,
      "furniture-detail:risk-cabinet:left-door",
    );
    expect(riskCabinetDoor.kind).toBe("amenity");
    if (riskCabinetDoor.kind !== "amenity") return;
    expect(riskCabinetDoor.modelRole).toBe("cabinet-door");
    expectScaledMesh(riskCabinetDoor);

    const equipmentPanel = findObject(
      objects,
      "fixture-detail:cabinet-0:panel",
    );
    expect(equipmentPanel.kind).toBe("amenity");
    if (equipmentPanel.kind !== "amenity") return;
    expect(equipmentPanel.modelRole).toBe("cabinet-panel");
    expectScaledMesh(equipmentPanel);

    const orchestrator = findObject(objects, "agent:orchestrator");
    expect(orchestrator.kind).toBe("agent");
    if (orchestrator.kind !== "agent") return;
    expect(orchestrator.label).toBe(officeCopy.en.orchestrator);
    expect(orchestrator.modelRole).toBe("agent-head");
    expect(orchestrator.role).toBe("Executing");
    expect(orchestrator.radius).toBeGreaterThan(0);
    expectVector3(orchestrator.position);
    expect(orchestrator.color).toMatch(/^#/);

    const orchestratorBody = findObject(
      objects,
      "agent-detail:orchestrator:body",
    );
    expect(orchestratorBody.kind).toBe("amenity");
    if (orchestratorBody.kind !== "amenity") return;
    expect(orchestratorBody.modelRole).toBe("agent-body");
    expect(orchestratorBody.shape).toBe("cylinder");
    expectScaledMesh(orchestratorBody);
    expect(orchestrator.color).not.toBe(orchestratorBody.color);
    expect(orchestrator.radius).toBeLessThan(orchestratorBody.scale[1]);
    expect(orchestratorBody.scale[0]).toBeGreaterThan(
      orchestrator.radius * 1.8,
    );

    const orchestratorBadge = findObject(
      objects,
      "agent-detail:orchestrator:badge",
    );
    expect(orchestratorBadge.kind).toBe("amenity");
    if (orchestratorBadge.kind !== "amenity") return;
    expect(orchestratorBadge.modelRole).toBe("agent-badge");
    expectScaledMesh(orchestratorBadge);

    const orchestratorLeftLeg = findObject(
      objects,
      "agent-detail:orchestrator:left-leg",
    );
    expect(orchestratorLeftLeg.kind).toBe("amenity");
    if (orchestratorLeftLeg.kind !== "amenity") return;
    expect(orchestratorLeftLeg.modelRole).toBe("agent-leg");
    expectScaledMesh(orchestratorLeftLeg);
    expect(orchestratorLeftLeg.position[1]).toBeLessThan(
      orchestratorBody.position[1],
    );
    expect(orchestratorLeftLeg.scale[1]).toBeGreaterThan(
      orchestrator.radius * 0.6,
    );
  });
});

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

    const commandDesk = findObject(objects, "desk:command_table");
    expect(commandDesk.kind).toBe("desk");
    if (commandDesk.kind !== "desk") return;
    expect(commandDesk.label).toBe(officeCopy.en.station.command_table);
    expect(commandDesk.stationId).toBe("command_table");
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

    const orchestrator = findObject(objects, "agent:orchestrator");
    expect(orchestrator.kind).toBe("agent");
    if (orchestrator.kind !== "agent") return;
    expect(orchestrator.label).toBe(officeCopy.en.orchestrator);
    expect(orchestrator.role).toBe("Executing");
    expect(orchestrator.radius).toBeGreaterThan(0);
    expectVector3(orchestrator.position);
    expect(orchestrator.color).toMatch(/^#/);
  });

  it("localizes active team labels while keeping stable semantic ids", async () => {
    const { createOfficeThreeSceneCatalog } = await loadSceneCatalogModule();

    const contract = createOfficeThreeSceneCatalog({
      locale: "ko",
      stage: officeCopy.ko.stage.planning,
      teamId: "knowledge_curation_desk",
    });
    const objects = contract.scene.objects;
    const agentIds = objects
      .filter((object) => object.kind === "agent")
      .map((object) => object.id);

    expect(agentIds).toEqual([
      "agent:orchestrator",
      "agent:llm_wiki_curator",
      "agent:report_writer",
    ]);

    const commandDesk = findObject(objects, "desk:command_table");
    expect(commandDesk.label).toBe(officeCopy.ko.station.command_table);

    const wikiAgent = findObject(objects, "agent:llm_wiki_curator");
    expect(wikiAgent.kind).toBe("agent");
    if (wikiAgent.kind !== "agent") return;
    expect(wikiAgent.label).toBe(officeCopy.ko.specialist.llm_wiki_curator);
    expect(wikiAgent.role).toBe(officeCopy.ko.station.market_desk);
    expectVector3(wikiAgent.position);
  });
});

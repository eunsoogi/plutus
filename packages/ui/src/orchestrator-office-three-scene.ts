import type { AppLocale } from "./core";
import { glassWalls } from "./orchestrator-office-canvas-amenities-data";
import { officeCuboids } from "./orchestrator-office-canvas-furnishings";
import { officeFurnitureRects } from "./orchestrator-office-canvas-furniture";
import { OFFICE_GRID } from "./orchestrator-office-canvas-geometry";
import {
  officeCopy,
  type OfficeStationLabels,
} from "./orchestrator-office-copy";
import {
  defaultTeam,
  teamSpecialists,
  type SpecialistId,
  type TeamId,
} from "./orchestrator-office-teams";
import {
  createOfficeThreeRendererContract,
  type OfficeThreeAmenityObject,
  type OfficeThreeDeskObject,
  type OfficeThreeMotionMode,
  type OfficeThreeRendererContract,
  type OfficeThreeRoomObject,
  type OfficeThreeSceneObject,
} from "./orchestrator-office-three-types";
import {
  boundaryWalls,
  commandTable,
  furnitureSemantic,
  officeThreeFurnitureRect,
  officeThreePlanterLocation,
  officeThreePlanterLocations,
  officeThreeStationRect,
  stationIdFor,
} from "./orchestrator-office-three-scene-data";
import {
  canvasLiftUnit,
  pointPosition,
  rectPosition,
  rectScale,
  vector3,
  wallPosition,
  wallScale,
  type OfficeThreeSceneRect,
} from "./orchestrator-office-three-scene-geometry";
import { furnitureDetailObjects } from "./orchestrator-office-three-scene-amenity-details";
import {
  agentDetailObjects,
  agentObjects,
  officeAgents,
} from "./orchestrator-office-three-scene-agents";
import { deskDetailObjectsFor } from "./orchestrator-office-three-scene-desk-details";
import { fixtureDetailObjects } from "./orchestrator-office-three-scene-fixture-details";
import { plantLeafObjects } from "./orchestrator-office-three-scene-plant-details";
import { roomTrimObjects } from "./orchestrator-office-three-scene-room-details";

export type OfficeThreeSceneCatalogInput = {
  readonly locale?: AppLocale;
  readonly motionMode?: OfficeThreeMotionMode;
  readonly stage?: string;
  readonly teamId?: TeamId;
};

function boundaryWallObject(index: number): OfficeThreeRoomObject {
  const wall = boundaryWalls[index] ?? boundaryWalls[0];
  return {
    color: wall.fill,
    id: `room:boundary-wall-${index}`,
    kind: "room",
    label: `Boundary wall ${index + 1}`,
    modelRole: "wall-panel",
    opacity: 0.62,
    position: wallPosition(wall),
    scale: wallScale(wall),
  };
}

function glassWallObject(index: number): OfficeThreeRoomObject {
  const wall = glassWalls[index] ?? glassWalls[0];
  return {
    color: wall.fill,
    id: `room:glass-wall-${index}`,
    kind: "room",
    label: `Glass wall ${index + 1}`,
    modelRole: "wall-panel",
    opacity: 0.72,
    position: wallPosition(wall),
    scale: wallScale(wall),
  };
}

function roomObjects(): readonly OfficeThreeRoomObject[] {
  return [
    {
      color: "#d6bd98",
      id: "room:floor",
      kind: "room",
      label: "Office floor",
      position: rectPosition({
        depth: OFFICE_GRID.rows,
        height: 0.04,
        width: OFFICE_GRID.columns,
        x: 0,
        y: 0,
      }),
      scale: vector3(OFFICE_GRID.columns * 0.72, 0.04, OFFICE_GRID.rows * 0.72),
    },
    ...boundaryWalls.map((_, index) => boundaryWallObject(index)),
    ...glassWalls.map((_, index) => glassWallObject(index)),
  ];
}

function commandDeskObject(
  stationLabels: OfficeStationLabels,
): OfficeThreeDeskObject {
  return {
    color: "#232d37",
    id: "desk:command_table",
    kind: "desk",
    label: stationLabels.command_table,
    modelRole: "desk-surface",
    position: rectPosition(commandTable),
    scale: rectScale(commandTable),
    stationId: "command_table",
  };
}

function specialistDeskObject(
  index: number,
  stationLabels: OfficeStationLabels,
): OfficeThreeDeskObject {
  const stationId = stationIdFor(index);
  const rect = officeThreeStationRect(index);
  return {
    color: "#f2d0a0",
    id: `desk:${stationId}`,
    kind: "desk",
    label: stationLabels[stationId],
    modelRole: "desk-surface",
    position: rectPosition(rect),
    scale: rectScale(rect),
    stationId,
  };
}

function deskObjects(
  specialists: readonly SpecialistId[],
  stationLabels: OfficeStationLabels,
): readonly OfficeThreeDeskObject[] {
  return [
    commandDeskObject(stationLabels),
    ...specialists.map((_, index) =>
      specialistDeskObject(index, stationLabels),
    ),
  ];
}

function furnitureObject(index: number): OfficeThreeAmenityObject {
  const furniture = officeFurnitureRects[index] ?? officeFurnitureRects[0];
  const semantic = furnitureSemantic(index);
  const rect = officeThreeFurnitureRect(index);
  return {
    color: furniture.fill,
    id: `furniture:${semantic.id}`,
    kind: "amenity",
    label: semantic.label,
    position: rectPosition(rect),
    scale: rectScale(rect),
  };
}

function fixtureCuboidObject(index: number): OfficeThreeAmenityObject {
  const cuboid = officeCuboids[index] ?? officeCuboids[0];
  const height = cuboid.height * canvasLiftUnit;
  const rect = { ...cuboid, height } satisfies OfficeThreeSceneRect;
  return {
    color: cuboid.top,
    id: `fixture:cuboid-${index}`,
    kind: "amenity",
    label: `Equipment fixture ${index + 1}`,
    modelRole: "fixture-body",
    position: rectPosition(rect),
    scale: rectScale(rect),
  };
}

function planterObject(index: number): OfficeThreeAmenityObject {
  const location = officeThreePlanterLocation(index);
  return {
    color: "#70c9aa",
    id: `plant:${index}`,
    kind: "amenity",
    label: `Planter ${index + 1}`,
    modelRole: "planter-pot",
    position: pointPosition(location, 0.28),
    scale: vector3(0.34, 0.56, 0.34),
    shape: "cylinder",
  };
}

function amenityObjects(
  specialists: readonly SpecialistId[],
  stationLabels: OfficeStationLabels,
): readonly OfficeThreeAmenityObject[] {
  return [
    ...roomTrimObjects(),
    ...deskDetailObjectsFor(specialists, stationLabels),
    ...officeFurnitureRects.map((_, index) => furnitureObject(index)),
    ...furnitureDetailObjects(),
    ...officeCuboids.map((_, index) => fixtureCuboidObject(index)),
    ...fixtureDetailObjects(),
    ...officeThreePlanterLocations.map((_, index) => planterObject(index)),
    ...plantLeafObjects(),
  ];
}

export function createOfficeThreeSceneCatalog(
  input: OfficeThreeSceneCatalogInput = {},
): OfficeThreeRendererContract {
  const locale = input.locale ?? "en";
  const labels = officeCopy[locale];
  const specialists = teamSpecialists[input.teamId ?? defaultTeam];
  const stage = input.stage ?? labels.stage.planning;
  const agents = officeAgents(specialists, labels, stage);
  const objects: readonly OfficeThreeSceneObject[] = [
    ...roomObjects(),
    ...deskObjects(specialists, labels.station),
    ...amenityObjects(specialists, labels.station),
    ...agentDetailObjects(agents),
    ...agentObjects(agents),
  ];

  return createOfficeThreeRendererContract({
    scene: { motion: { mode: input.motionMode ?? "idle" }, objects },
  });
}

export const officeThreeSceneCatalog = createOfficeThreeSceneCatalog();

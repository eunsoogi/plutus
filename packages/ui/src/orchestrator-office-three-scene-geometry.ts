import type { OfficeWall } from "./orchestrator-office-canvas-amenities-data";
import { OFFICE_GRID } from "./orchestrator-office-canvas-geometry";
import type { GridPoint } from "./orchestrator-office-scene-data";
import type { OfficeThreeVector3 } from "./orchestrator-office-three-types";

export type OfficeThreeSceneRect = {
  readonly depth: number;
  readonly height: number;
  readonly width: number;
  readonly x: number;
  readonly y: number;
};

export const canvasLiftUnit = 0.01;

const gridUnit = 0.72;
const wallThickness = 0.08;

export function vector3(x: number, y: number, z: number): OfficeThreeVector3 {
  return [x, y, z];
}

function gridX(x: number): number {
  return (x - OFFICE_GRID.columns / 2) * gridUnit;
}

function gridZ(y: number): number {
  return (y - OFFICE_GRID.rows / 2) * gridUnit;
}

export function rectPosition(rect: OfficeThreeSceneRect): OfficeThreeVector3 {
  return vector3(
    gridX(rect.x + rect.width / 2),
    rect.height / 2,
    gridZ(rect.y + rect.depth / 2),
  );
}

export function rectScale(rect: OfficeThreeSceneRect): OfficeThreeVector3 {
  return vector3(rect.width * gridUnit, rect.height, rect.depth * gridUnit);
}

function wallHeight(wall: OfficeWall): number {
  return wall.height * canvasLiftUnit;
}

export function wallPosition(wall: OfficeWall): OfficeThreeVector3 {
  const height = wallHeight(wall);
  return vector3(
    gridX((wall.start.x + wall.end.x) / 2),
    height / 2,
    gridZ((wall.start.y + wall.end.y) / 2),
  );
}

export function wallScale(wall: OfficeWall): OfficeThreeVector3 {
  return vector3(
    Math.max(Math.abs(wall.end.x - wall.start.x) * gridUnit, wallThickness),
    wallHeight(wall),
    Math.max(Math.abs(wall.end.y - wall.start.y) * gridUnit, wallThickness),
  );
}

export function pointPosition(
  point: GridPoint,
  height: number,
): OfficeThreeVector3 {
  return vector3(gridX(point.x), height, gridZ(point.y));
}

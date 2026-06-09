import {
  rectPosition,
  vector3,
  type OfficeThreeSceneRect,
} from "./orchestrator-office-three-scene-geometry";
import { officeThreeFurnitureRect } from "./orchestrator-office-three-scene-data";

export type FurnitureSemantic = {
  readonly id: string;
  readonly label: string;
};

export function furnitureRect(index: number): OfficeThreeSceneRect {
  return officeThreeFurnitureRect(index);
}

export function rectDetailPosition(
  rect: OfficeThreeSceneRect,
  xOffset: number,
  y: number,
  zOffset: number,
): ReturnType<typeof vector3> {
  const position = rectPosition(rect);
  return vector3(position[0] + xOffset, y, position[2] + zOffset);
}

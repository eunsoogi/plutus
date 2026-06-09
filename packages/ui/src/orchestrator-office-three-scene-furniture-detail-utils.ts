import { officeFurnitureRects } from "./orchestrator-office-canvas-furniture";
import {
  canvasLiftUnit,
  rectPosition,
  vector3,
  type OfficeThreeSceneRect,
} from "./orchestrator-office-three-scene-geometry";

export type FurnitureSemantic = {
  readonly id: string;
  readonly label: string;
};

export function furnitureRect(index: number): OfficeThreeSceneRect {
  const furniture = officeFurnitureRects[index] ?? officeFurnitureRects[0];
  return {
    depth: furniture.depth,
    height: Math.max(0.22, furniture.lift * canvasLiftUnit),
    width: furniture.width,
    x: furniture.x,
    y: furniture.y,
  };
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

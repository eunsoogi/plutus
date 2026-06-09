import { officeCuboids } from "./orchestrator-office-canvas-furnishings";
import type { OfficeThreeAmenityObject } from "./orchestrator-office-three-types";
import {
  canvasLiftUnit,
  rectPosition,
  rectScale,
  vector3,
  type OfficeThreeSceneRect,
} from "./orchestrator-office-three-scene-geometry";
import { detailObject } from "./orchestrator-office-three-scene-detail-utils";

function rectDetailPosition(
  rect: OfficeThreeSceneRect,
  xOffset: number,
  y: number,
  zOffset: number,
): ReturnType<typeof vector3> {
  const position = rectPosition(rect);
  return vector3(position[0] + xOffset, y, position[2] + zOffset);
}

export function fixtureDetailObjects(): readonly OfficeThreeAmenityObject[] {
  return officeCuboids.slice(0, 2).flatMap((cuboid, index) => {
    const rect = {
      depth: cuboid.depth,
      height: cuboid.height * canvasLiftUnit,
      width: cuboid.width,
      x: cuboid.x,
      y: cuboid.y,
    } satisfies OfficeThreeSceneRect;
    const scale = rectScale(rect);
    return [
      detailObject({
        color: cuboid.front,
        id: `fixture-detail:cabinet-${index}:body`,
        label: `Equipment cabinet ${index + 1} body`,
        modelRole: "cabinet-body",
        position: rectDetailPosition(rect, 0, rect.height / 2 + 0.02, 0),
        scale: vector3(scale[0] * 0.88, rect.height * 0.92, scale[2] * 0.88),
      }),
      detailObject({
        color: cuboid.stroke,
        id: `fixture-detail:cabinet-${index}:panel`,
        label: `Equipment cabinet ${index + 1} panel`,
        modelRole: "cabinet-panel",
        position: rectDetailPosition(
          rect,
          0,
          rect.height * 0.58,
          scale[2] / 2 + 0.025,
        ),
        scale: vector3(scale[0] * 0.58, rect.height * 0.36, 0.05),
      }),
    ];
  });
}

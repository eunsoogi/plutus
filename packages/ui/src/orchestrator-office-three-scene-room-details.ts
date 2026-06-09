import type { OfficeThreeAmenityObject } from "./orchestrator-office-three-types";
import { boundaryWalls } from "./orchestrator-office-three-scene-data";
import {
  vector3,
  wallPosition,
  wallScale,
} from "./orchestrator-office-three-scene-geometry";
import { detailObject } from "./orchestrator-office-three-scene-detail-utils";

export function roomTrimObjects(): readonly OfficeThreeAmenityObject[] {
  return boundaryWalls.flatMap((wall, index) => {
    const position = wallPosition(wall);
    const scale = wallScale(wall);
    return [
      detailObject({
        color: wall.stroke,
        id: `room-detail:boundary-wall-${index}:top-trim`,
        label: `Boundary wall ${index + 1} top trim`,
        modelRole: "wall-trim",
        position: vector3(position[0], scale[1] + 0.035, position[2]),
        scale: vector3(scale[0] + 0.04, 0.07, scale[2] + 0.04),
      }),
      detailObject({
        color: "#3f3436",
        id: `room-detail:boundary-wall-${index}:base-thickness`,
        label: `Boundary wall ${index + 1} base thickness`,
        modelRole: "wall-trim",
        position: vector3(position[0], 0.06, position[2]),
        scale: vector3(scale[0] + 0.14, 0.12, scale[2] + 0.14),
      }),
    ];
  });
}

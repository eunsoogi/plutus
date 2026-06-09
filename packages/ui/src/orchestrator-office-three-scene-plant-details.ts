import { planterLocations } from "./orchestrator-office-canvas-amenities-data";
import type { OfficeThreeAmenityObject } from "./orchestrator-office-three-types";
import {
  pointPosition,
  vector3,
} from "./orchestrator-office-three-scene-geometry";
import { detailObject } from "./orchestrator-office-three-scene-detail-utils";

export function plantLeafObjects(): readonly OfficeThreeAmenityObject[] {
  return planterLocations.flatMap((location, index) => {
    const base = pointPosition(location, 0.68);
    return [
      detailObject({
        color: "#3d9f73",
        id: `plant-detail:${index}:leaf-a`,
        label: `Planter ${index + 1} leaves`,
        modelRole: "plant-leaf",
        position: vector3(base[0] - 0.08, base[1], base[2]),
        rotation: vector3(0, 0.38, 0.24),
        scale: vector3(0.1, 0.34, 0.16),
      }),
      detailObject({
        color: "#55b88b",
        id: `plant-detail:${index}:leaf-b`,
        label: `Planter ${index + 1} leaves`,
        modelRole: "plant-leaf",
        position: vector3(base[0] + 0.08, base[1] + 0.04, base[2] + 0.03),
        rotation: vector3(0, -0.42, -0.18),
        scale: vector3(0.1, 0.38, 0.16),
      }),
    ];
  });
}

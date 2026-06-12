import { officeFurnitureRects } from "./orchestrator-office-canvas-furniture";
import type { OfficeThreeAmenityObject } from "./orchestrator-office-three-types";
import {
  coffeeTableDetailObjects,
  riskCabinetDetailObjects,
  terminalDetailObjects,
} from "./orchestrator-office-three-scene-equipment-details";
import { furnitureSemantic } from "./orchestrator-office-three-scene-data";
import {
  reportBenchDetailObjects,
  sofaDetailObjects,
} from "./orchestrator-office-three-scene-seating-details";
import { kenneyFurnitureDetailObjects } from "./orchestrator-office-three-scene-kenney-details";

export function furnitureDetailObjects(): readonly OfficeThreeAmenityObject[] {
  return [
    ...officeFurnitureRects.flatMap((_, index) => {
      const semantic = furnitureSemantic(index);
      if (semantic.id === "sofa" || semantic.id === "strategy-sofa") {
        return sofaDetailObjects(index, semantic);
      }
      if (semantic.id === "coffee-table") {
        return coffeeTableDetailObjects(index, semantic);
      }
      if (
        semantic.id === "market-terminal" ||
        semantic.id === "signal-console"
      ) {
        return terminalDetailObjects(index, semantic);
      }
      if (semantic.id === "report-bench") {
        return reportBenchDetailObjects(index, semantic);
      }
      if (semantic.id === "risk-cabinet") {
        return riskCabinetDetailObjects(index, semantic);
      }
      return [];
    }),
    ...kenneyFurnitureDetailObjects(),
  ];
}

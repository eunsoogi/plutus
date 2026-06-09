import type { OfficeThreeAmenityObject } from "./orchestrator-office-three-types";
import { rectScale, vector3 } from "./orchestrator-office-three-scene-geometry";
import { detailObject } from "./orchestrator-office-three-scene-detail-utils";
import {
  furnitureRect,
  rectDetailPosition,
  type FurnitureSemantic,
} from "./orchestrator-office-three-scene-furniture-detail-utils";

export function terminalDetailObjects(
  index: number,
  semantic: FurnitureSemantic,
): readonly OfficeThreeAmenityObject[] {
  const rect = furnitureRect(index);
  const scale = rectScale(rect);
  return [
    detailObject({
      color: "#0f172a",
      id: `furniture-detail:${semantic.id}:screen`,
      label: `${semantic.label} screen`,
      modelRole: "terminal-screen",
      position: rectDetailPosition(
        rect,
        0,
        rect.height + 0.2,
        -scale[2] / 2 - 0.02,
      ),
      rotation: vector3(-0.22, 0, 0),
      scale: vector3(scale[0] * 0.72, 0.38, 0.04),
    }),
    detailObject({
      color: "#62cbe0",
      id: `furniture-detail:${semantic.id}:panel`,
      label: `${semantic.label} control panel`,
      modelRole: "terminal-panel",
      opacity: 0.9,
      position: rectDetailPosition(
        rect,
        0,
        rect.height + 0.04,
        scale[2] / 2 - 0.08,
      ),
      scale: vector3(scale[0] * 0.62, 0.06, 0.18),
    }),
  ];
}

export function coffeeTableDetailObjects(
  index: number,
  semantic: FurnitureSemantic,
): readonly OfficeThreeAmenityObject[] {
  const rect = furnitureRect(index);
  const scale = rectScale(rect);
  const legX = scale[0] / 2 - 0.08;
  const legZ = scale[2] / 2 - 0.06;
  const legs = [
    [-legX, -legZ],
    [legX, -legZ],
    [-legX, legZ],
    [legX, legZ],
  ] as const;
  return [
    detailObject({
      color: "#c89d62",
      id: `furniture-detail:${semantic.id}:top`,
      label: `${semantic.label} top`,
      modelRole: "coffee-table-top",
      position: rectDetailPosition(rect, 0, rect.height + 0.04, 0),
      scale: vector3(scale[0] * 0.9, 0.08, scale[2] * 0.86),
    }),
    ...legs.map(([xOffset, zOffset], legIndex) =>
      detailObject({
        color: "#8a6440",
        id: `furniture-detail:${semantic.id}:leg-${legIndex + 1}`,
        label: `${semantic.label} leg ${legIndex + 1}`,
        modelRole: "coffee-table-leg",
        position: rectDetailPosition(rect, xOffset, rect.height / 2, zOffset),
        scale: vector3(0.06, rect.height, 0.06),
      }),
    ),
  ];
}

export function riskCabinetDetailObjects(
  index: number,
  semantic: FurnitureSemantic,
): readonly OfficeThreeAmenityObject[] {
  const rect = furnitureRect(index);
  const scale = rectScale(rect);
  return [
    detailObject({
      color: "#24303b",
      id: `furniture-detail:${semantic.id}:left-door`,
      label: `${semantic.label} left door`,
      modelRole: "cabinet-door",
      position: rectDetailPosition(
        rect,
        -scale[0] * 0.18,
        rect.height * 0.58,
        scale[2] / 2 + 0.03,
      ),
      scale: vector3(scale[0] * 0.32, rect.height * 0.66, 0.05),
    }),
    detailObject({
      color: "#24303b",
      id: `furniture-detail:${semantic.id}:right-door`,
      label: `${semantic.label} right door`,
      modelRole: "cabinet-door",
      position: rectDetailPosition(
        rect,
        scale[0] * 0.18,
        rect.height * 0.58,
        scale[2] / 2 + 0.03,
      ),
      scale: vector3(scale[0] * 0.32, rect.height * 0.66, 0.05),
    }),
    detailObject({
      color: "#64748b",
      id: `furniture-detail:${semantic.id}:shelf`,
      label: `${semantic.label} shelf`,
      modelRole: "cabinet-shelf",
      position: rectDetailPosition(
        rect,
        0,
        rect.height * 0.68,
        scale[2] / 2 + 0.06,
      ),
      scale: vector3(scale[0] * 0.72, 0.04, 0.06),
    }),
    detailObject({
      color: "#d7e0ea",
      id: `furniture-detail:${semantic.id}:left-handle`,
      label: `${semantic.label} left handle`,
      modelRole: "cabinet-handle",
      position: rectDetailPosition(
        rect,
        -scale[0] * 0.08,
        rect.height * 0.58,
        scale[2] / 2 + 0.075,
      ),
      scale: vector3(0.035, rect.height * 0.28, 0.035),
    }),
    detailObject({
      color: "#d7e0ea",
      id: `furniture-detail:${semantic.id}:right-handle`,
      label: `${semantic.label} right handle`,
      modelRole: "cabinet-handle",
      position: rectDetailPosition(
        rect,
        scale[0] * 0.08,
        rect.height * 0.58,
        scale[2] / 2 + 0.075,
      ),
      scale: vector3(0.035, rect.height * 0.28, 0.035),
    }),
  ];
}

import type { OfficeThreeAmenityObject } from "./orchestrator-office-three-types";
import { rectScale, vector3 } from "./orchestrator-office-three-scene-geometry";
import { detailObject } from "./orchestrator-office-three-scene-detail-utils";
import {
  furnitureRect,
  rectDetailPosition,
  type FurnitureSemantic,
} from "./orchestrator-office-three-scene-furniture-detail-utils";

export function sofaDetailObjects(
  index: number,
  semantic: FurnitureSemantic,
): readonly OfficeThreeAmenityObject[] {
  const rect = furnitureRect(index);
  const scale = rectScale(rect);
  const zBack = -scale[2] / 2 + 0.08;
  const zSeat = scale[2] * 0.05;
  return [
    detailObject({
      color: "#7e5472",
      id: `furniture-detail:${semantic.id}:seat`,
      label: `${semantic.label} seat`,
      modelRole: "sofa-seat",
      position: rectDetailPosition(rect, 0, rect.height + 0.08, zSeat),
      scale: vector3(scale[0] * 0.86, 0.16, scale[2] * 0.62),
    }),
    detailObject({
      color: "#6f4864",
      id: `furniture-detail:${semantic.id}:back`,
      label: `${semantic.label} back`,
      modelRole: "sofa-back",
      position: rectDetailPosition(rect, 0, rect.height + 0.22, zBack),
      scale: vector3(scale[0] * 0.92, 0.42, 0.12),
    }),
    detailObject({
      color: "#8c5d7b",
      id: `furniture-detail:${semantic.id}:left-arm`,
      label: `${semantic.label} left arm`,
      modelRole: "sofa-arm",
      position: rectDetailPosition(
        rect,
        -scale[0] / 2 + 0.08,
        rect.height + 0.16,
        zSeat,
      ),
      scale: vector3(0.16, 0.34, scale[2] * 0.72),
    }),
    detailObject({
      color: "#8c5d7b",
      id: `furniture-detail:${semantic.id}:right-arm`,
      label: `${semantic.label} right arm`,
      modelRole: "sofa-arm",
      position: rectDetailPosition(
        rect,
        scale[0] / 2 - 0.08,
        rect.height + 0.16,
        zSeat,
      ),
      scale: vector3(0.16, 0.34, scale[2] * 0.72),
    }),
    detailObject({
      color: "#d4a8c6",
      id: `furniture-detail:${semantic.id}:cushion`,
      label: `${semantic.label} cushion`,
      modelRole: "sofa-cushion",
      position: rectDetailPosition(rect, 0, rect.height + 0.2, zSeat + 0.08),
      scale: vector3(scale[0] * 0.34, 0.14, scale[2] * 0.34),
    }),
  ];
}

export function reportBenchDetailObjects(
  index: number,
  semantic: FurnitureSemantic,
): readonly OfficeThreeAmenityObject[] {
  const rect = furnitureRect(index);
  const scale = rectScale(rect);
  return [
    detailObject({
      color: "#c87969",
      id: `furniture-detail:${semantic.id}:seat`,
      label: `${semantic.label} seat`,
      modelRole: "report-bench-seat",
      position: rectDetailPosition(rect, 0, rect.height + 0.06, 0),
      scale: vector3(scale[0] * 0.9, 0.12, scale[2] * 0.72),
    }),
    detailObject({
      color: "#8a5a52",
      id: `furniture-detail:${semantic.id}:left-leg`,
      label: `${semantic.label} left leg`,
      modelRole: "report-bench-leg",
      position: rectDetailPosition(
        rect,
        -scale[0] / 2 + 0.14,
        rect.height / 2,
        0,
      ),
      scale: vector3(0.08, rect.height, scale[2] * 0.52),
    }),
    detailObject({
      color: "#8a5a52",
      id: `furniture-detail:${semantic.id}:right-leg`,
      label: `${semantic.label} right leg`,
      modelRole: "report-bench-leg",
      position: rectDetailPosition(
        rect,
        scale[0] / 2 - 0.14,
        rect.height / 2,
        0,
      ),
      scale: vector3(0.08, rect.height, scale[2] * 0.52),
    }),
  ];
}

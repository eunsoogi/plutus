import type { OfficeStationLabels } from "./orchestrator-office-copy";
import { slotFor } from "./orchestrator-office-scene-data";
import type { SpecialistId } from "./orchestrator-office-teams";
import type { OfficeThreeAmenityObject } from "./orchestrator-office-three-types";
import {
  commandTable,
  stationIdFor,
} from "./orchestrator-office-three-scene-data";
import {
  rectPosition,
  rectScale,
  vector3,
  type OfficeThreeSceneRect,
} from "./orchestrator-office-three-scene-geometry";
import { detailObject } from "./orchestrator-office-three-scene-detail-utils";

function detailPosition(
  rect: OfficeThreeSceneRect,
  xOffset: number,
  y: number,
  zOffset: number,
): ReturnType<typeof vector3> {
  const position = rectPosition(rect);
  return vector3(position[0] + xOffset, y, position[2] + zOffset);
}

function deskDetailObjects(
  id: string,
  label: string,
  rect: OfficeThreeSceneRect,
): readonly OfficeThreeAmenityObject[] {
  const scale = rectScale(rect);
  const surfaceTop = rect.height + 0.02;
  const legX = scale[0] / 2 - 0.12;
  const legZ = scale[2] / 2 - 0.12;
  const chairZ = scale[2] / 2 + 0.24;
  const monitorZ = -scale[2] / 2 + 0.18;
  const deskLegs = [
    [-legX, -legZ],
    [legX, -legZ],
    [-legX, legZ],
    [legX, legZ],
  ] as const;

  return [
    ...deskLegs.map(([xOffset, zOffset], index) =>
      detailObject({
        color: "#6b4b3a",
        id: `desk-detail:${id}:leg-${index + 1}`,
        label: `${label} leg ${index + 1}`,
        modelRole: "desk-leg",
        position: detailPosition(rect, xOffset, rect.height / 2, zOffset),
        scale: vector3(0.08, rect.height, 0.08),
      }),
    ),
    detailObject({
      color: "#344256",
      id: `desk-detail:${id}:monitor-stand`,
      label: `${label} monitor stand`,
      modelRole: "monitor-stand",
      position: detailPosition(rect, 0, surfaceTop + 0.12, monitorZ),
      scale: vector3(0.08, 0.24, 0.08),
      shape: "cylinder",
    }),
    detailObject({
      color: "#142033",
      id: `desk-detail:${id}:monitor-screen`,
      label: `${label} monitor screen`,
      modelRole: "monitor-screen",
      position: detailPosition(rect, 0, surfaceTop + 0.28, monitorZ - 0.03),
      scale: vector3(Math.min(0.48, scale[0] * 0.34), 0.28, 0.04),
    }),
    detailObject({
      color: "#566171",
      id: `desk-detail:${id}:chair-seat`,
      label: `${label} chair seat`,
      modelRole: "chair-seat",
      position: detailPosition(rect, 0, 0.24, chairZ),
      scale: vector3(0.42, 0.16, 0.34),
    }),
    detailObject({
      color: "#46515f",
      id: `desk-detail:${id}:chair-back`,
      label: `${label} chair back`,
      modelRole: "chair-back",
      position: detailPosition(rect, 0, 0.5, chairZ + 0.16),
      scale: vector3(0.44, 0.48, 0.08),
    }),
  ];
}

function specialistDeskRect(index: number, stationLabels: OfficeStationLabels) {
  const slot = slotFor(index, stationLabels);
  return {
    depth: slot.deskDepth,
    height: 0.48,
    width: slot.deskWidth,
    x: slot.deskTile.x,
    y: slot.deskTile.y,
  } satisfies OfficeThreeSceneRect;
}

export function deskDetailObjectsFor(
  specialists: readonly SpecialistId[],
  stationLabels: OfficeStationLabels,
): readonly OfficeThreeAmenityObject[] {
  return [
    ...deskDetailObjects(
      "command_table",
      stationLabels.command_table,
      commandTable,
    ),
    ...specialists.flatMap((_, index) => {
      const stationId = stationIdFor(index);
      return deskDetailObjects(
        stationId,
        stationLabels[stationId],
        specialistDeskRect(index, stationLabels),
      );
    }),
  ];
}

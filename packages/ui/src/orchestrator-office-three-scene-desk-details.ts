import type { OfficeStationLabels } from "./orchestrator-office-copy";
import type { SpecialistId } from "./orchestrator-office-teams";
import type { OfficeThreeAmenityObject } from "./orchestrator-office-three-types";
import {
  commandTable,
  officeThreeStationRect,
  type OfficeStationId,
  stationIdFor,
} from "./orchestrator-office-three-scene-data";
import {
  deskFidelityDetailObjects,
  type DeskFacing,
} from "./orchestrator-office-three-scene-desk-fidelity-details";
import {
  rectPosition,
  rectScale,
  vector3,
  type OfficeThreeSceneRect,
} from "./orchestrator-office-three-scene-geometry";
import { detailObject } from "./orchestrator-office-three-scene-detail-utils";

const deskFacingByStation = {
  command_table: "south",
  market_desk: "east",
  report_bay: "north",
  risk_table: "north",
  signal_booth: "south",
  strategy_board: "west",
} satisfies Record<OfficeStationId, DeskFacing>;

function detailPosition(
  rect: OfficeThreeSceneRect,
  xOffset: number,
  y: number,
  zOffset: number,
): ReturnType<typeof vector3> {
  const position = rectPosition(rect);
  return vector3(position[0] + xOffset, y, position[2] + zOffset);
}

function furnitureSideOffset(
  facing: DeskFacing,
  sideDistance: number,
): readonly [number, number] {
  switch (facing) {
    case "east":
      return [sideDistance, 0];
    case "north":
      return [0, -sideDistance];
    case "south":
      return [0, sideDistance];
    case "west":
      return [-sideDistance, 0];
  }
}

function sideRotation(facing: DeskFacing): ReturnType<typeof vector3> {
  switch (facing) {
    case "east":
      return vector3(0, -Math.PI / 2, 0);
    case "north":
      return vector3(0, Math.PI, 0);
    case "south":
      return vector3(0, 0, 0);
    case "west":
      return vector3(0, Math.PI / 2, 0);
  }
}

function deskDetailObjects(
  id: string,
  label: string,
  rect: OfficeThreeSceneRect,
  facing: DeskFacing,
): readonly OfficeThreeAmenityObject[] {
  const scale = rectScale(rect);
  const surfaceTop = rect.height + 0.02;
  const legX = scale[0] / 2 - 0.12;
  const legZ = scale[2] / 2 - 0.12;
  const chairDistance =
    facing === "east" || facing === "west"
      ? scale[0] / 2 + 0.28
      : scale[2] / 2 + 0.26;
  const monitorDistance =
    facing === "east" || facing === "west"
      ? scale[0] / 2 - 0.18
      : scale[2] / 2 - 0.18;
  const [chairX, chairZ] = furnitureSideOffset(facing, chairDistance);
  const [monitorX, monitorZ] = furnitureSideOffset(facing, -monitorDistance);
  const [keyboardX, keyboardZ] = furnitureSideOffset(
    facing,
    monitorDistance * 0.08,
  );
  const rotated = facing === "east" || facing === "west";
  const chairScale = rotated
    ? vector3(0.34, 0.16, 0.42)
    : vector3(0.42, 0.16, 0.34);
  const chairBackScale = rotated
    ? vector3(0.08, 0.48, 0.44)
    : vector3(0.44, 0.48, 0.08);
  const monitorScale = rotated
    ? vector3(0.04, 0.28, Math.min(0.48, scale[0] * 0.34))
    : vector3(Math.min(0.48, scale[0] * 0.34), 0.28, 0.04);
  const equipmentClusterScale = rotated
    ? vector3(0.15, 0.045, 0.26)
    : vector3(0.26, 0.045, 0.15);
  const chairBackDistance = chairDistance + 0.17;
  const [chairBackX, chairBackZ] = furnitureSideOffset(
    facing,
    chairBackDistance,
  );
  const deskLegs = [
    [-legX, -legZ],
    [legX, -legZ],
    [-legX, legZ],
    [legX, legZ],
  ] as const;
  const chairLegX = chairScale[0] / 2 - 0.045;
  const chairLegZ = chairScale[2] / 2 - 0.045;
  const chairLegs = [
    [-chairLegX, -chairLegZ],
    [chairLegX, -chairLegZ],
    [-chairLegX, chairLegZ],
    [chairLegX, chairLegZ],
  ] as const;
  const sideClusterX = keyboardX + (rotated ? 0 : scale[0] * 0.2);
  const sideClusterZ = keyboardZ + (rotated ? scale[2] * 0.2 : 0);

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
    ...deskFidelityDetailObjects(id, label, rect, facing),
    detailObject({
      color: "#344256",
      id: `desk-detail:${id}:monitor-stand`,
      label: `${label} monitor stand`,
      modelRole: "monitor-stand",
      position: detailPosition(rect, monitorX, surfaceTop + 0.12, monitorZ),
      scale: vector3(0.08, 0.24, 0.08),
      shape: "cylinder",
    }),
    detailObject({
      color: "#142033",
      id: `desk-detail:${id}:monitor-screen`,
      label: `${label} monitor screen`,
      modelRole: "monitor-screen",
      position: detailPosition(rect, monitorX, surfaceTop + 0.28, monitorZ),
      rotation: sideRotation(facing),
      scale: monitorScale,
    }),
    detailObject({
      color: "#223047",
      id: `desk-detail:${id}:keyboard-cluster`,
      label: `${label} keyboard cluster`,
      modelRole: "desk-equipment-cluster",
      position: detailPosition(rect, keyboardX, surfaceTop + 0.04, keyboardZ),
      rotation: sideRotation(facing),
      scale: equipmentClusterScale,
    }),
    detailObject({
      color: "#8fb8cb",
      id: `desk-detail:${id}:notebook-cluster`,
      label: `${label} notebook cluster`,
      modelRole: "desk-equipment-cluster",
      opacity: 0.9,
      position: detailPosition(
        rect,
        sideClusterX,
        surfaceTop + 0.045,
        sideClusterZ,
      ),
      scale: vector3(0.16, 0.05, 0.12),
    }),
    detailObject({
      color: "#566171",
      id: `desk-detail:${id}:chair-seat`,
      label: `${label} chair seat`,
      modelRole: "chair-seat",
      position: detailPosition(rect, chairX, 0.24, chairZ),
      scale: chairScale,
    }),
    detailObject({
      color: "#46515f",
      id: `desk-detail:${id}:chair-back`,
      label: `${label} chair back`,
      modelRole: "chair-back",
      position: detailPosition(rect, chairBackX, 0.5, chairBackZ),
      rotation: sideRotation(facing),
      scale: chairBackScale,
    }),
    ...chairLegs.map(([xOffset, zOffset], index) =>
      detailObject({
        color: "#2f3844",
        id: `desk-detail:${id}:chair-leg-${index + 1}`,
        label: `${label} chair leg ${index + 1}`,
        modelRole: "chair-leg",
        position: detailPosition(rect, chairX + xOffset, 0.13, chairZ + zOffset),
        scale: vector3(0.045, 0.26, 0.045),
      }),
    ),
  ];
}

function specialistDeskRect(index: number): OfficeThreeSceneRect {
  return officeThreeStationRect(index);
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
      deskFacingByStation.command_table,
    ),
    ...specialists.flatMap((_, index) => {
      const stationId = stationIdFor(index);
      return deskDetailObjects(
        stationId,
        stationLabels[stationId],
        specialistDeskRect(index),
        deskFacingByStation[stationId],
      );
    }),
  ];
}

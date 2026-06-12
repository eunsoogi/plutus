import type { OfficeThreeAmenityObject } from "./orchestrator-office-three-types";
import {
  commandTable,
  officeThreeFurnitureRect,
  officeThreePlanterLocation,
} from "./orchestrator-office-three-scene-data";
import {
  pointPosition,
  rectPosition,
  rectScale,
  vector3,
  type OfficeThreeSceneRect,
} from "./orchestrator-office-three-scene-geometry";
import { detailObject } from "./orchestrator-office-three-scene-detail-utils";
import type { DeskFacing } from "./orchestrator-office-three-scene-desk-fidelity-details";

function detailPosition(
  rect: OfficeThreeSceneRect,
  xOffset: number,
  y: number,
  zOffset: number,
): ReturnType<typeof vector3> {
  const position = rectPosition(rect);
  return vector3(position[0] + xOffset, y, position[2] + zOffset);
}

function sideOffset(
  facing: DeskFacing,
  distance: number,
): readonly [number, number] {
  switch (facing) {
    case "east":
      return [distance, 0];
    case "north":
      return [0, -distance];
    case "south":
      return [0, distance];
    case "west":
      return [-distance, 0];
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

export function kenneyDeskDetailObjects(
  id: string,
  label: string,
  rect: OfficeThreeSceneRect,
  facing: DeskFacing,
): readonly OfficeThreeAmenityObject[] {
  const scale = rectScale(rect);
  const rotated = facing === "east" || facing === "west";
  const surfaceTop = rect.height + 0.03;
  const monitorDistance =
    facing === "east" || facing === "west"
      ? scale[0] / 2 - 0.22
      : scale[2] / 2 - 0.22;
  const chairDistance =
    facing === "east" || facing === "west"
      ? scale[0] / 2 + 0.28
      : scale[2] / 2 + 0.26;
  const [monitorX, monitorZ] = sideOffset(facing, -monitorDistance);
  const [chairX, chairZ] = sideOffset(facing, chairDistance);
  const [keyboardX, keyboardZ] = sideOffset(facing, monitorDistance * 0.12);
  const mouseX = keyboardX + (rotated ? 0 : scale[0] * 0.24);
  const mouseZ = keyboardZ + (rotated ? scale[2] * 0.24 : 0);

  return [
    detailObject({
      color: "#c8975a",
      id: `kenney-desk:${id}:wood-top`,
      label: `${label} Kenney desk`,
      modelRole: "kenney-desk",
      position: detailPosition(rect, 0, surfaceTop, 0),
      scale: vector3(scale[0] * 0.96, 0.055, scale[2] * 0.9),
    }),
    detailObject({
      color: "#4e5965",
      id: `kenney-chair:${id}:desk-chair`,
      label: `${label} Kenney desk chair`,
      modelRole: "kenney-desk-chair",
      position: detailPosition(rect, chairX, 0.29, chairZ),
      rotation: sideRotation(facing),
      scale: rotated ? vector3(0.36, 0.22, 0.5) : vector3(0.5, 0.22, 0.36),
    }),
    detailObject({
      color: "#0f1b2b",
      id: `kenney-computer:${id}:screen`,
      label: `${label} Kenney computer screen`,
      modelRole: "kenney-computer-screen",
      position: detailPosition(rect, monitorX, surfaceTop + 0.31, monitorZ),
      rotation: sideRotation(facing),
      scale: rotated ? vector3(0.045, 0.34, 0.46) : vector3(0.46, 0.34, 0.045),
    }),
    detailObject({
      color: "#29384a",
      id: `kenney-computer:${id}:keyboard`,
      label: `${label} Kenney computer keyboard`,
      modelRole: "kenney-computer-keyboard",
      position: detailPosition(rect, keyboardX, surfaceTop + 0.035, keyboardZ),
      rotation: sideRotation(facing),
      scale: rotated ? vector3(0.08, 0.035, 0.34) : vector3(0.34, 0.035, 0.08),
    }),
    detailObject({
      color: "#cbd5df",
      id: `kenney-computer:${id}:mouse`,
      label: `${label} Kenney computer mouse`,
      modelRole: "kenney-computer-mouse",
      position: detailPosition(rect, mouseX, surfaceTop + 0.04, mouseZ),
      scale: vector3(0.09, 0.035, 0.12),
    }),
  ];
}

export function kenneyFurnitureDetailObjects(): readonly OfficeThreeAmenityObject[] {
  const bookcase = officeThreeFurnitureRect(6);
  const lamp = officeThreeFurnitureRect(5);
  const rug = officeThreeFurnitureRect(1);
  const storage = officeThreeFurnitureRect(2);
  const plant = officeThreePlanterLocation(0);
  const commandScale = rectScale(commandTable);

  return [
    detailObject({
      color: "#805f3d",
      id: "kenney-furniture:bookcase-open",
      label: "Kenney open bookcase",
      modelRole: "kenney-bookcase-open",
      position: detailPosition(bookcase, 0, bookcase.height * 0.7, -0.08),
      scale: vector3(0.68, bookcase.height * 1.18, 0.16),
    }),
    detailObject({
      color: "#d6b46f",
      id: "kenney-furniture:storage-box",
      label: "Kenney closed storage box",
      modelRole: "kenney-storage-box",
      position: detailPosition(storage, 0.2, storage.height + 0.12, 0.06),
      scale: vector3(0.36, 0.24, 0.28),
    }),
    detailObject({
      color: "#374151",
      id: "kenney-furniture:coat-rack-standing",
      label: "Kenney standing coat rack",
      modelRole: "kenney-coat-rack",
      position: detailPosition(bookcase, -0.62, 0.64, 0.16),
      scale: vector3(0.08, 1.28, 0.08),
      shape: "cylinder",
    }),
    detailObject({
      color: "#e6c27a",
      id: "kenney-furniture:floor-lamp",
      label: "Kenney square floor lamp",
      modelRole: "kenney-floor-lamp",
      position: detailPosition(lamp, 0, lamp.height + 0.48, 0),
      scale: vector3(0.24, 0.96, 0.24),
    }),
    detailObject({
      color: "#7f8f9f",
      id: "kenney-furniture:rug-rectangle",
      label: "Kenney rectangle rug",
      modelRole: "kenney-rug-rectangle",
      position: detailPosition(
        commandTable,
        0,
        0.045,
        commandScale[2] / 2 + 0.44,
      ),
      scale: vector3(commandScale[0] * 1.2, 0.035, 0.62),
    }),
    detailObject({
      color: "#4ea66e",
      id: "kenney-furniture:plant-small",
      label: "Kenney small plant",
      modelRole: "kenney-plant-small",
      position: pointPosition(plant, 0.76),
      scale: vector3(0.22, 0.44, 0.22),
      shape: "sphere",
    }),
    detailObject({
      color: "#38485a",
      id: "kenney-furniture:lamp-base",
      label: "Kenney floor lamp base",
      modelRole: "kenney-floor-lamp",
      position: detailPosition(lamp, 0, 0.28, 0),
      scale: vector3(0.08, 0.56, 0.08),
      shape: "cylinder",
    }),
  ];
}

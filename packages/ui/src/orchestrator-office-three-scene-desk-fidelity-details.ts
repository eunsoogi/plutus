import type { OfficeThreeAmenityObject } from "./orchestrator-office-three-types";
import {
  rectPosition,
  rectScale,
  vector3,
  type OfficeThreeSceneRect,
} from "./orchestrator-office-three-scene-geometry";
import { detailObject } from "./orchestrator-office-three-scene-detail-utils";

export type DeskFacing = "east" | "north" | "south" | "west";

function detailPosition(
  rect: OfficeThreeSceneRect,
  xOffset: number,
  y: number,
  zOffset: number,
): ReturnType<typeof vector3> {
  const position = rectPosition(rect);
  return vector3(position[0] + xOffset, y, position[2] + zOffset);
}

function drawerOffset(
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

function drawerScale(
  facing: DeskFacing,
  width: number,
  depth: number,
): ReturnType<typeof vector3> {
  if (facing === "east" || facing === "west") {
    return vector3(0.04, 0.16, depth * 0.46);
  }
  return vector3(width * 0.46, 0.16, 0.04);
}

export function deskFidelityDetailObjects(
  id: string,
  label: string,
  rect: OfficeThreeSceneRect,
  facing: DeskFacing,
): readonly OfficeThreeAmenityObject[] {
  const scale = rectScale(rect);
  const halfX = scale[0] / 2;
  const halfZ = scale[2] / 2;
  const surfaceY = rect.height + 0.065;
  const lipY = rect.height + 0.11;
  const drawerDistance =
    facing === "east" || facing === "west" ? halfX + 0.025 : halfZ + 0.025;
  const [drawerX, drawerZ] = drawerOffset(facing, drawerDistance);
  return [
    detailObject({
      color: "#f7dfb9",
      id: `desk-detail:${id}:front-edge`,
      label: `${label} front edge`,
      modelRole: "desk-edge",
      position: detailPosition(rect, 0, surfaceY, halfZ - 0.02),
      scale: vector3(scale[0] * 0.94, 0.05, 0.05),
    }),
    detailObject({
      color: "#d99f61",
      id: `desk-detail:${id}:left-edge`,
      label: `${label} left edge`,
      modelRole: "desk-edge",
      position: detailPosition(rect, -halfX + 0.02, surfaceY, 0),
      scale: vector3(0.05, 0.05, scale[2] * 0.9),
    }),
    detailObject({
      color: "#d99f61",
      id: `desk-detail:${id}:right-edge`,
      label: `${label} right edge`,
      modelRole: "desk-edge",
      position: detailPosition(rect, halfX - 0.02, surfaceY, 0),
      scale: vector3(0.05, 0.05, scale[2] * 0.9),
    }),
    detailObject({
      color: "#f4d09a",
      id: `desk-detail:${id}:front-lip`,
      label: `${label} front lip`,
      modelRole: "desk-lip",
      position: detailPosition(rect, 0, lipY, halfZ - 0.08),
      scale: vector3(scale[0] * 0.7, 0.045, 0.08),
    }),
    detailObject({
      color: "#c77f48",
      id: `desk-detail:${id}:rear-lip`,
      label: `${label} rear lip`,
      modelRole: "desk-lip",
      position: detailPosition(rect, 0, lipY, -halfZ + 0.08),
      scale: vector3(scale[0] * 0.64, 0.045, 0.08),
    }),
    detailObject({
      color: "#e7bd82",
      id: `desk-detail:${id}:inset-panel`,
      label: `${label} inset panel`,
      modelRole: "desk-inset-panel",
      opacity: 0.82,
      position: detailPosition(rect, 0, lipY + 0.02, 0),
      scale: vector3(scale[0] * 0.48, 0.025, scale[2] * 0.36),
    }),
    detailObject({
      color: "#9b7045",
      id: `desk-detail:${id}:drawer`,
      label: `${label} drawer`,
      modelRole: "desk-drawer",
      position: detailPosition(rect, drawerX, rect.height * 0.58, drawerZ),
      scale: drawerScale(facing, scale[0], scale[2]),
    }),
  ];
}

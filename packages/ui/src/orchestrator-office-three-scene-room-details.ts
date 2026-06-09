import type { OfficeThreeAmenityObject } from "./orchestrator-office-three-types";
import { boundaryWalls } from "./orchestrator-office-three-scene-data";
import {
  rectPosition,
  rectScale,
  vector3,
  wallPosition,
  wallScale,
  type OfficeThreeSceneRect,
} from "./orchestrator-office-three-scene-geometry";
import { detailObject } from "./orchestrator-office-three-scene-detail-utils";

const zoneRugs = [
  {
    color: "#3b4b5f",
    id: "command-rug",
    label: "Command rug",
    rect: { depth: 2.2, height: 0.018, width: 3.2, x: 3.2, y: 2.6 },
  },
  {
    color: "#6e5a79",
    id: "lounge-rug",
    label: "Lounge rug",
    rect: { depth: 1.92, height: 0.018, width: 3.72, x: 5.38, y: 0.22 },
  },
] as const satisfies readonly {
  readonly color: string;
  readonly id: string;
  readonly label: string;
  readonly rect: OfficeThreeSceneRect;
}[];

const partitionPanels = [
  {
    color: "#74889d",
    id: "market",
    label: "Market partition",
    rect: { depth: 1.06, height: 0.58, width: 0.08, x: 1.78, y: 1.76 },
  },
  {
    color: "#7f8c74",
    id: "risk",
    label: "Risk partition",
    rect: { depth: 1.28, height: 0.54, width: 0.08, x: 6.08, y: 4.08 },
  },
] as const satisfies readonly {
  readonly color: string;
  readonly id: string;
  readonly label: string;
  readonly rect: OfficeThreeSceneRect;
}[];

function wallBaseRailPosition(
  wall: (typeof boundaryWalls)[number],
): ReturnType<typeof vector3> {
  const position = wallPosition(wall);
  const minX = Math.min(wall.start.x, wall.end.x);
  const minZ = Math.min(wall.start.y, wall.end.y);
  const xOffset =
    wall.start.x === wall.end.x ? (minX === 0 ? 0.09 : -0.09) : 0;
  const zOffset =
    wall.start.y === wall.end.y ? (minZ === 0 ? 0.09 : -0.09) : 0;
  return vector3(position[0] + xOffset, 0.08, position[2] + zOffset);
}

function wallBaseRailScale(
  wall: (typeof boundaryWalls)[number],
): ReturnType<typeof vector3> {
  const scale = wallScale(wall);
  if (scale[0] >= scale[2]) {
    return vector3(scale[0] * 0.98, 0.08, 0.06);
  }
  return vector3(0.06, 0.08, scale[2] * 0.98);
}

export function roomTrimObjects(): readonly OfficeThreeAmenityObject[] {
  const wallDetails = boundaryWalls.flatMap((wall, index) => {
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
      detailObject({
        color: "#5a4446",
        id: `room-detail:boundary-wall-${index}:base-rail`,
        label: `Boundary wall ${index + 1} base rail`,
        modelRole: "wall-base-rail",
        position: wallBaseRailPosition(wall),
        scale: wallBaseRailScale(wall),
      }),
    ];
  });

  const rugDetails = zoneRugs.map((rug) =>
    detailObject({
      color: rug.color,
      id: `room-detail:zone:${rug.id}`,
      label: rug.label,
      modelRole: "rug-zone",
      opacity: 0.5,
      position: rectPosition(rug.rect),
      scale: rectScale(rug.rect),
    }),
  );

  const partitionDetails = partitionPanels.map((partition) =>
    detailObject({
      color: partition.color,
      id: `room-detail:partition:${partition.id}`,
      label: partition.label,
      modelRole: "partition-panel",
      opacity: 0.78,
      position: rectPosition(partition.rect),
      scale: rectScale(partition.rect),
    }),
  );

  return [...wallDetails, ...rugDetails, ...partitionDetails];
}

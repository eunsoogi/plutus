import {
  officeFootprint,
  projectOfficePoint,
} from "./orchestrator-office-canvas-geometry";
import {
  accentFloors,
  glassWalls,
  planterLocations,
  type OfficeCuboid,
  type OfficeWall,
} from "./orchestrator-office-canvas-amenities-data";
import { officeCuboids } from "./orchestrator-office-canvas-furnishings";
import type {
  OfficeCanvasPoint,
  OfficeDrawCommand,
  OfficeProjection,
  OfficeVolumeSurface,
} from "./orchestrator-office-canvas-types";

function wallPanel(
  wall: OfficeWall,
  rotation: OfficeProjection,
): readonly OfficeCanvasPoint[] {
  return [
    projectOfficePoint(wall.start, rotation, wall.height),
    projectOfficePoint(wall.end, rotation, wall.height),
    projectOfficePoint(wall.end, rotation),
    projectOfficePoint(wall.start, rotation),
  ];
}

function volumeMeta(
  volumeId: string | undefined,
  surface: OfficeVolumeSurface,
):
  | Record<string, never>
  | { readonly surface: OfficeVolumeSurface; readonly volumeId: string } {
  return volumeId === undefined ? {} : { surface, volumeId };
}

function pushCuboid(
  commands: OfficeDrawCommand[],
  block: OfficeCuboid,
  rotation: OfficeProjection,
  volumeId?: string,
): void {
  const top = officeFootprint(
    block.x,
    block.y,
    block.width,
    block.depth,
    rotation,
    block.height,
  );
  const base = officeFootprint(
    block.x,
    block.y,
    block.width,
    block.depth,
    rotation,
  );

  commands.push(
    {
      ...volumeMeta(volumeId, "shadow"),
      alpha: 0.16,
      fill: "#0f172a",
      kind: "polygon",
      points: base,
    },
    {
      ...volumeMeta(volumeId, "front"),
      fill: block.front,
      kind: "polygon",
      lineWidth: 2,
      points: [top[3], top[2], base[2], base[3]],
      stroke: block.stroke,
    },
    {
      ...volumeMeta(volumeId, "side"),
      fill: block.side,
      kind: "polygon",
      lineWidth: 2,
      points: [top[1], top[2], base[2], base[1]],
      stroke: block.stroke,
    },
    {
      ...volumeMeta(volumeId, "top"),
      fill: block.top,
      kind: "polygon",
      lineWidth: 2,
      points: top,
      stroke: block.stroke,
    },
  );
}

function pushPlanter(
  commands: OfficeDrawCommand[],
  location: OfficeCanvasPoint,
  rotation: OfficeProjection,
): void {
  pushCuboid(
    commands,
    {
      depth: 0.22,
      front: "#805f42",
      height: 18,
      side: "#674b34",
      stroke: "#a77d52",
      top: "#b8875a",
      width: 0.24,
      x: location.x,
      y: location.y,
    },
    rotation,
  );

  const center = {
    x: location.x + 0.12,
    y: location.y + 0.1,
  };
  const base = projectOfficePoint(center, rotation, 24);
  for (const leaf of [
    { dx: -0.26, dy: -0.06, lift: 78 },
    { dx: 0.0, dy: -0.24, lift: 92 },
    { dx: 0.24, dy: -0.02, lift: 74 },
  ] as const) {
    commands.push({
      fill: "rgb(126 224 198 / 0.82)",
      kind: "polygon",
      lineWidth: 1,
      points: [
        base,
        projectOfficePoint(
          { x: center.x + leaf.dx, y: center.y + leaf.dy },
          rotation,
          leaf.lift,
        ),
        projectOfficePoint(
          { x: center.x + leaf.dx * 0.22, y: center.y + leaf.dy * 0.22 },
          rotation,
          leaf.lift + 18,
        ),
      ],
      stroke: "#4c9789",
    });
  }
}

export function pushOfficeAmenities(
  commands: OfficeDrawCommand[],
  rotation: OfficeProjection,
): void {
  for (const floor of accentFloors) {
    commands.push({
      fill: floor.fill,
      kind: "polygon",
      lineWidth: 2,
      points: officeFootprint(
        floor.x,
        floor.y,
        floor.width,
        floor.depth,
        rotation,
      ),
      stroke: floor.stroke,
    });
  }

  for (const wall of glassWalls) {
    commands.push({
      alpha: 0.78,
      fill: wall.fill,
      kind: "polygon",
      lineWidth: 2,
      points: wallPanel(wall, rotation),
      stroke: wall.stroke,
    });
  }

  for (const [index, block] of officeCuboids.entries()) {
    pushCuboid(commands, block, rotation, `amenity-cuboid-${index}`);
  }

  for (const location of planterLocations) {
    pushPlanter(commands, location, rotation);
  }
}

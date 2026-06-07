import {
  OFFICE_CANVAS_VIEWPORT,
  OFFICE_GRID,
  officeFootprint,
  projectOfficePoint,
} from "./orchestrator-office-canvas-geometry";
import { pushOfficeAmenities } from "./orchestrator-office-canvas-amenities";
import { pushFurniture } from "./orchestrator-office-canvas-furniture";
import type {
  OfficeCanvasPoint,
  OfficeDrawCommand,
  OfficeProjection,
} from "./orchestrator-office-canvas-types";
import type { AgentSlot } from "./orchestrator-office-scene-data";

function wallPanel(
  start: OfficeCanvasPoint,
  end: OfficeCanvasPoint,
  rotation: OfficeProjection,
  height: number,
): readonly OfficeCanvasPoint[] {
  return [
    projectOfficePoint(start, rotation, height),
    projectOfficePoint(end, rotation, height),
    projectOfficePoint(end, rotation),
    projectOfficePoint(start, rotation),
  ];
}

function pushFloor(
  commands: OfficeDrawCommand[],
  rotation: OfficeProjection,
): void {
  commands.push({
    fill: "#10100d",
    height: OFFICE_CANVAS_VIEWPORT.height,
    kind: "rect",
    width: OFFICE_CANVAS_VIEWPORT.width,
    x: 0,
    y: 0,
  });

  commands.push({
    fill: "#a36f6b",
    kind: "polygon",
    lineWidth: 3,
    points: wallPanel(
      { x: 0, y: 0 },
      { x: OFFICE_GRID.columns, y: 0 },
      rotation,
      156,
    ),
    stroke: "#6d4b4d",
  });
  commands.push({
    fill: "#8b8f98",
    kind: "polygon",
    lineWidth: 3,
    points: wallPanel(
      { x: OFFICE_GRID.columns, y: 0 },
      { x: OFFICE_GRID.columns, y: OFFICE_GRID.rows },
      rotation,
      126,
    ),
    stroke: "#5e626b",
  });

  for (let row = 0; row < OFFICE_GRID.rows; row += 1) {
    for (let column = 0; column < OFFICE_GRID.columns; column += 1) {
      commands.push({
        fill: (row + column) % 2 === 0 ? "#f1dfc4" : "#ead3b2",
        kind: "polygon",
        lineWidth: 1,
        points: officeFootprint(column, row, 1, 1, rotation),
        stroke: "#cfb98f",
      });
    }
  }
}

function pushRooms(
  commands: OfficeDrawCommand[],
  rotation: OfficeProjection,
): void {
  const partitions = [
    [
      { x: 0.4, y: 3.2 },
      { x: 4.2, y: 3.2 },
    ],
    [
      { x: 4.2, y: 0.5 },
      { x: 4.2, y: 3.2 },
    ],
    [
      { x: 2.7, y: 3.2 },
      { x: 2.7, y: 5.3 },
    ],
    [
      { x: 6.4, y: 2.4 },
      { x: 9.6, y: 2.4 },
    ],
    [
      { x: 6.4, y: 2.4 },
      { x: 6.4, y: 6.3 },
    ],
    [
      { x: 1.1, y: 5.2 },
      { x: 3.8, y: 5.2 },
    ],
  ] satisfies readonly (readonly [OfficeCanvasPoint, OfficeCanvasPoint])[];

  commands.push({
    fill: "rgb(139 181 197 / 0.25)",
    kind: "polygon",
    lineWidth: 2,
    points: officeFootprint(0.7, 4.8, 2.2, 1.3, rotation),
    stroke: "#7d9aad",
  });

  for (const [start, end] of partitions) {
    commands.push({
      alpha: 0.82,
      fill: "#868b94",
      kind: "polygon",
      lineWidth: 2,
      points: wallPanel(start, end, rotation, 94),
      stroke: "#5e626b",
    });
  }
}

export function pushDeskCommands(
  commands: OfficeDrawCommand[],
  slot: AgentSlot,
  rotation: OfficeProjection,
  deskIndex: number,
): void {
  const volumeId = `desk-${deskIndex}`;
  const top = officeFootprint(
    slot.deskTile.x,
    slot.deskTile.y,
    slot.deskWidth,
    slot.deskDepth,
    rotation,
    48,
  );
  const base = officeFootprint(
    slot.deskTile.x,
    slot.deskTile.y,
    slot.deskWidth,
    slot.deskDepth,
    rotation,
  );

  commands.push(
    {
      fill: "rgb(25 19 15 / 0.34)",
      kind: "polygon",
      lineWidth: 0,
      points: base,
      volumeId,
      surface: "shadow",
    },
    {
      fill: "#d09b63",
      kind: "polygon",
      lineWidth: 2,
      points: [top[3], top[2], base[2], base[3]],
      surface: "front",
      volumeId,
      stroke: "#875f3d",
    },
    {
      fill: "#e5b77d",
      kind: "polygon",
      lineWidth: 2,
      points: [top[1], top[2], base[2], base[1]],
      surface: "side",
      volumeId,
      stroke: "#875f3d",
    },
    {
      fill: "#f2d0a0",
      kind: "polygon",
      lineWidth: 2,
      points: top,
      surface: "top",
      volumeId,
      stroke: "#8d6b47",
    },
    {
      fill: "#263f55",
      kind: "polygon",
      lineWidth: 1,
      points: officeFootprint(
        slot.deskTile.x + 0.68,
        slot.deskTile.y + 0.12,
        0.3,
        0.16,
        rotation,
        78,
      ),
      stroke: "#9fd5eb",
    },
    {
      fill: "#fff3e5",
      kind: "polygon",
      points: officeFootprint(
        slot.deskTile.x + 0.46,
        slot.deskTile.y + 0.48,
        0.44,
        0.12,
        rotation,
        54,
      ),
    },
    {
      fill: "#9b7aa0",
      kind: "polygon",
      lineWidth: 1,
      points: officeFootprint(
        slot.agentTile.x - 0.24,
        slot.agentTile.y - 0.26,
        0.46,
        0.34,
        rotation,
        24,
      ),
      stroke: "#6c5470",
    },
  );
}

export function pushOfficeFixtureCommands(
  commands: OfficeDrawCommand[],
  rotation: OfficeProjection,
): void {
  pushFloor(commands, rotation);
  pushRooms(commands, rotation);
  pushOfficeAmenities(commands, rotation);
  pushFurniture(commands, rotation);
}

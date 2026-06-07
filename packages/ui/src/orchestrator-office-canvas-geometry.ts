import type {
  OfficeCanvasPoint,
  OfficeCanvasQuad,
  OfficeRotation,
  OfficeRotationDirection,
} from "./orchestrator-office-canvas-types";

export const OFFICE_CANVAS_VIEWPORT = {
  height: 760,
  width: 1200,
} as const;

export const OFFICE_GRID = {
  columns: 10,
  rows: 7,
} as const;

const TILE_SIZE = {
  height: 74,
  width: 132,
} as const;

const OFFICE_CENTER = {
  x: 600,
  y: 410,
} as const;

type OfficeBounds = {
  readonly columns: number;
  readonly rows: number;
};

function assertNever(value: never): never {
  throw new Error(`Unhandled office rotation: ${value}`);
}

export function nextOfficeRotation(
  rotation: OfficeRotation,
  direction: OfficeRotationDirection,
): OfficeRotation {
  switch (rotation) {
    case "south-east":
      return direction === "right" ? "south-west" : "north-east";
    case "south-west":
      return direction === "right" ? "north-west" : "south-east";
    case "north-west":
      return direction === "right" ? "north-east" : "south-west";
    case "north-east":
      return direction === "right" ? "south-east" : "north-west";
    default:
      return assertNever(rotation);
  }
}

export function officeRotationLabel(rotation: OfficeRotation): string {
  switch (rotation) {
    case "south-east":
      return "South East";
    case "south-west":
      return "South West";
    case "north-west":
      return "North West";
    case "north-east":
      return "North East";
    default:
      return assertNever(rotation);
  }
}

export function officeBoundsFor(rotation: OfficeRotation): OfficeBounds {
  switch (rotation) {
    case "south-east":
    case "north-west":
      return { columns: OFFICE_GRID.columns, rows: OFFICE_GRID.rows };
    case "south-west":
    case "north-east":
      return { columns: OFFICE_GRID.rows, rows: OFFICE_GRID.columns };
    default:
      return assertNever(rotation);
  }
}

export function rotateOfficePoint(
  point: OfficeCanvasPoint,
  rotation: OfficeRotation,
): OfficeCanvasPoint {
  switch (rotation) {
    case "south-east":
      return point;
    case "south-west":
      return { x: OFFICE_GRID.rows - point.y, y: point.x };
    case "north-west":
      return {
        x: OFFICE_GRID.columns - point.x,
        y: OFFICE_GRID.rows - point.y,
      };
    case "north-east":
      return { x: point.y, y: OFFICE_GRID.columns - point.x };
    default:
      return assertNever(rotation);
  }
}

export function projectOfficePoint(
  point: OfficeCanvasPoint,
  rotation: OfficeRotation,
  lift = 0,
): OfficeCanvasPoint {
  const rotated = rotateOfficePoint(point, rotation);
  const bounds = officeBoundsFor(rotation);
  const centeredX = rotated.x - bounds.columns / 2;
  const centeredY = rotated.y - bounds.rows / 2;

  return {
    x: OFFICE_CENTER.x + (centeredX - centeredY) * (TILE_SIZE.width / 2),
    y:
      OFFICE_CENTER.y + (centeredX + centeredY) * (TILE_SIZE.height / 2) - lift,
  };
}

export function officeFootprint(
  x: number,
  y: number,
  width: number,
  depth: number,
  rotation: OfficeRotation,
  lift = 0,
): OfficeCanvasQuad {
  return [
    projectOfficePoint({ x, y }, rotation, lift),
    projectOfficePoint({ x: x + width, y }, rotation, lift),
    projectOfficePoint({ x: x + width, y: y + depth }, rotation, lift),
    projectOfficePoint({ x, y: y + depth }, rotation, lift),
  ];
}

export function officeDepth(
  point: OfficeCanvasPoint,
  rotation: OfficeRotation,
): number {
  const rotated = rotateOfficePoint(point, rotation);
  return rotated.x + rotated.y;
}

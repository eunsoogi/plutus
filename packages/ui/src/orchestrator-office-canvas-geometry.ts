import type {
  OfficeCanvasPoint,
  OfficeCanvasQuad,
  OfficeProjection,
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

const OFFICE_YAW_BY_ROTATION: Readonly<Record<OfficeRotation, number>> = {
  "south-east": 0,
  "south-west": 90,
  "north-west": 180,
  "north-east": 270,
} as const;

const OFFICE_ROTATION_BY_YAW: readonly OfficeRotation[] = [
  "south-east",
  "south-west",
  "north-west",
  "north-east",
] as const;

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

export function normalizeOfficeYaw(angle: number): number {
  if (!Number.isFinite(angle)) {
    return 0;
  }

  const normalized = angle % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

export function officeRotationForYaw(angle: number): OfficeRotation {
  const normalizedYaw = normalizeOfficeYaw(angle);
  const index = Math.round(normalizedYaw / 90) % OFFICE_ROTATION_BY_YAW.length;
  return OFFICE_ROTATION_BY_YAW[index];
}

export function officeYawForRotation(rotation: OfficeRotation): number {
  return OFFICE_YAW_BY_ROTATION[rotation];
}

export function nextOfficeYaw(
  angle: number,
  direction: OfficeRotationDirection,
): number {
  const delta = direction === "right" ? 90 : -90;
  return normalizeOfficeYaw(angle + delta);
}

function officeYawForProjection(projection: OfficeProjection): number {
  return typeof projection === "number"
    ? normalizeOfficeYaw(projection)
    : officeYawForRotation(projection);
}

function officeProjectionAxes(
  point: OfficeCanvasPoint,
  projection: OfficeProjection,
): {
  readonly rotatedX: number;
  readonly rotatedY: number;
} {
  const yaw = (officeYawForProjection(projection) * Math.PI) / 180;
  const centeredX = point.x - OFFICE_GRID.columns / 2;
  const centeredY = point.y - OFFICE_GRID.rows / 2;

  return {
    rotatedX: centeredX * Math.cos(yaw) - centeredY * Math.sin(yaw),
    rotatedY: centeredX * Math.sin(yaw) + centeredY * Math.cos(yaw),
  };
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
  projection: OfficeProjection,
  lift = 0,
): OfficeCanvasPoint {
  const { rotatedX, rotatedY } = officeProjectionAxes(point, projection);

  return {
    x: OFFICE_CENTER.x + (rotatedX - rotatedY) * (TILE_SIZE.width / 2),
    y:
      OFFICE_CENTER.y + (rotatedX + rotatedY) * (TILE_SIZE.height / 2) - lift,
  };
}

export function officeFootprint(
  x: number,
  y: number,
  width: number,
  depth: number,
  projection: OfficeProjection,
  lift = 0,
): OfficeCanvasQuad {
  return [
    projectOfficePoint({ x, y }, projection, lift),
    projectOfficePoint({ x: x + width, y }, projection, lift),
    projectOfficePoint({ x: x + width, y: y + depth }, projection, lift),
    projectOfficePoint({ x, y: y + depth }, projection, lift),
  ];
}

export function officeDepth(
  point: OfficeCanvasPoint,
  projection: OfficeProjection,
): number {
  const { rotatedX, rotatedY } = officeProjectionAxes(point, projection);
  return rotatedX + rotatedY;
}

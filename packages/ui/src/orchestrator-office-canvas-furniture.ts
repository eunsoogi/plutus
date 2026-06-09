import { officeFootprint } from "./orchestrator-office-canvas-geometry";
import type {
  OfficeDrawCommand,
  OfficeProjection,
  OfficeVolumeSurface,
} from "./orchestrator-office-canvas-types";

type OfficeFurnitureRectBase = {
  readonly depth: number;
  readonly fill: string;
  readonly lift: number;
  readonly lineWidth: number;
  readonly stroke: string;
  readonly width: number;
  readonly x: number;
  readonly y: number;
};

type OfficeFurnitureRect = OfficeFurnitureRectBase & {
  readonly frontFill: string;
  readonly sideFill: string;
};

function shadeHexColor(hex: string, amount: number): string {
  const normalized = hex.slice(1);
  const scale = amount >= 0 ? 1 + amount : 1 + amount;

  const shade = (channel: number): number =>
    Math.max(
      0,
      Math.min(
        255,
        Math.round(
          amount >= 0 ? channel + (255 - channel) * amount : channel * scale,
        ),
      ),
    );

  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);

  return `#${[red, green, blue]
    .map((channel) => shade(channel).toString(16).padStart(2, "0"))
    .join("")}`;
}

const officeFurnitureBaseRects = [
  {
    depth: 0.68,
    fill: "#b07b9f",
    lift: 18,
    lineWidth: 2,
    stroke: "#7e5472",
    width: 1.56,
    x: 5.86,
    y: 0.82,
  },
  {
    depth: 0.42,
    fill: "#d8b47a",
    lift: 14,
    lineWidth: 2,
    stroke: "#90704b",
    width: 1.04,
    x: 6.18,
    y: 1.72,
  },
  {
    depth: 0.78,
    fill: "#242c38",
    lift: 74,
    lineWidth: 2,
    stroke: "#6ecde2",
    width: 0.88,
    x: 0.72,
    y: 0.74,
  },
  {
    depth: 0.52,
    fill: "#293647",
    lift: 68,
    lineWidth: 2,
    stroke: "#6ecde2",
    width: 1.22,
    x: 2.25,
    y: 0.55,
  },
  {
    depth: 0.48,
    fill: "#d78d78",
    lift: 18,
    lineWidth: 2,
    stroke: "#8a5a52",
    width: 1.24,
    x: 0.82,
    y: 6.08,
  },
  {
    depth: 0.68,
    fill: "#70c9aa",
    lift: 20,
    lineWidth: 2,
    stroke: "#397b70",
    width: 1.35,
    x: 8.0,
    y: 0.95,
  },
  {
    depth: 0.76,
    fill: "#2b3540",
    lift: 42,
    lineWidth: 2,
    stroke: "#64748b",
    width: 0.94,
    x: 8.2,
    y: 4.85,
  },
] satisfies readonly OfficeFurnitureRectBase[];

export const officeFurnitureRects = officeFurnitureBaseRects.map(
  (furniture) => ({
    ...furniture,
    frontFill: shadeHexColor(furniture.fill, -0.12),
    sideFill: shadeHexColor(furniture.fill, -0.22),
  }),
) satisfies readonly OfficeFurnitureRect[];

export function pushFurniture(
  commands: OfficeDrawCommand[],
  rotation: OfficeProjection,
): void {
  for (const [index, furniture] of officeFurnitureRects.entries()) {
    const base = officeFootprint(
      furniture.x,
      furniture.y,
      furniture.width,
      furniture.depth,
      rotation,
    );
    const top = officeFootprint(
      furniture.x,
      furniture.y,
      furniture.width,
      furniture.depth,
      rotation,
      furniture.lift,
    );
    const volumeId = `furniture-${index}`;
    const volumeMeta = (surface: OfficeVolumeSurface) => ({
      surface,
      volumeId,
    });

    commands.push(
      {
        ...volumeMeta("shadow"),
        alpha: 0.16,
        fill: "#0f172a",
        kind: "polygon",
        points: base,
      },
      {
        ...volumeMeta("front"),
        fill: furniture.frontFill,
        kind: "polygon",
        lineWidth: furniture.lineWidth,
        points: [top[3], top[2], base[2], base[3]],
        stroke: furniture.stroke,
      },
      {
        ...volumeMeta("side"),
        fill: furniture.sideFill,
        kind: "polygon",
        lineWidth: furniture.lineWidth,
        points: [top[1], top[2], base[2], base[1]],
        stroke: furniture.stroke,
      },
      {
        ...volumeMeta("top"),
        fill: furniture.fill,
        kind: "polygon",
        lineWidth: furniture.lineWidth,
        points: top,
        stroke: furniture.stroke,
      },
    );
  }
}

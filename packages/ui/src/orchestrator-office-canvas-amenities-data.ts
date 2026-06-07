import type { OfficeCanvasPoint } from "./orchestrator-office-canvas-types";

export type OfficeCuboid = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly depth: number;
  readonly height: number;
  readonly top: string;
  readonly front: string;
  readonly side: string;
  readonly stroke: string;
};

export type OfficeFlatProp = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly depth: number;
  readonly fill: string;
  readonly stroke: string;
};

export type OfficeWall = {
  readonly start: OfficeCanvasPoint;
  readonly end: OfficeCanvasPoint;
  readonly height: number;
  readonly fill: string;
  readonly stroke: string;
};

export const accentFloors = [
  {
    depth: 1.15,
    fill: "rgb(112 201 170 / 0.58)",
    stroke: "#397b70",
    width: 1.7,
    x: 8.0,
    y: 0.72,
  },
  {
    depth: 0.62,
    fill: "rgb(159 210 234 / 0.36)",
    stroke: "#577b91",
    width: 2.0,
    x: 2.72,
    y: 0.5,
  },
  {
    depth: 0.55,
    fill: "rgb(217 138 153 / 0.48)",
    stroke: "#96545e",
    width: 2.1,
    x: 1.02,
    y: 4.12,
  },
  {
    depth: 0.52,
    fill: "rgb(245 198 95 / 0.42)",
    stroke: "#99773a",
    width: 1.4,
    x: 5.58,
    y: 4.9,
  },
  {
    depth: 0.45,
    fill: "rgb(173 138 217 / 0.44)",
    stroke: "#755999",
    width: 1.75,
    x: 3.2,
    y: 5.55,
  },
  {
    depth: 0.4,
    fill: "rgb(126 224 198 / 0.42)",
    stroke: "#3e8b7e",
    width: 1.12,
    x: 1.1,
    y: 6.06,
  },
] satisfies readonly OfficeFlatProp[];

export const glassWalls = [
  {
    end: { x: 2.25, y: 0.58 },
    fill: "rgb(117 137 149 / 0.64)",
    height: 82,
    start: { x: 0.34, y: 0.58 },
    stroke: "#596775",
  },
  {
    end: { x: 5.35, y: 1.05 },
    fill: "rgb(126 143 154 / 0.58)",
    height: 76,
    start: { x: 3.35, y: 1.05 },
    stroke: "#5a6874",
  },
  {
    end: { x: 9.72, y: 3.18 },
    fill: "rgb(126 143 154 / 0.62)",
    height: 84,
    start: { x: 7.12, y: 3.18 },
    stroke: "#5a6874",
  },
  {
    end: { x: 6.18, y: 6.38 },
    fill: "rgb(126 143 154 / 0.66)",
    height: 72,
    start: { x: 3.8, y: 6.38 },
    stroke: "#5a6874",
  },
  {
    end: { x: 0.5, y: 5.92 },
    fill: "rgb(126 143 154 / 0.58)",
    height: 68,
    start: { x: 0.5, y: 4.72 },
    stroke: "#5a6874",
  },
  {
    end: { x: 9.42, y: 5.18 },
    fill: "rgb(126 143 154 / 0.58)",
    height: 72,
    start: { x: 9.42, y: 3.92 },
    stroke: "#5a6874",
  },
] satisfies readonly OfficeWall[];

export const planterLocations = [
  { x: 0.42, y: 2.34 },
  { x: 4.9, y: 1.76 },
  { x: 6.78, y: 2.52 },
  { x: 9.1, y: 4.2 },
  { x: 2.34, y: 6.02 },
] as const;

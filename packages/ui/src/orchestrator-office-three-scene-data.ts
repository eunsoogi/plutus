import type { OfficeWall } from "./orchestrator-office-canvas-amenities-data";
import { officeFurnitureRects } from "./orchestrator-office-canvas-furniture";
import { OFFICE_GRID } from "./orchestrator-office-canvas-geometry";
import type { OfficeStationLabels } from "./orchestrator-office-copy";
import type { GridPoint } from "./orchestrator-office-scene-data";
import {
  canvasLiftUnit,
  type OfficeThreeSceneRect,
} from "./orchestrator-office-three-scene-geometry";

export type OfficeStationId = keyof OfficeStationLabels;
type OfficeThreeStationSceneLayout = OfficeThreeSceneRect & {
  readonly agentTile: GridPoint;
};

export const commandTable = {
  depth: 1.24,
  height: 0.52,
  width: 2.34,
  x: 4.08,
  y: 3.2,
} satisfies OfficeThreeSceneRect;

const furnitureSceneRects = [
  { x: 5.8, y: 0.58 },
  { x: 5.98, y: 1.46 },
  { x: 0.62, y: 0.72 },
  { x: 2.18, y: 0.52 },
  { x: 0.62, y: 6.02 },
  { x: 8.12, y: 0.78 },
  { x: 8.22, y: 4.72 },
] as const;

export const officeThreePlanterLocations = [
  { x: 0.42, y: 2.46 },
  { x: 4.9, y: 1.54 },
  { x: 8.88, y: 2.72 },
  { x: 9.12, y: 3.82 },
  { x: 2.06, y: 6.48 },
] satisfies readonly GridPoint[];

const stationSceneLayouts = [
  {
    agentTile: { x: 2.1, y: 3.35 },
    depth: 0.88,
    height: 0.48,
    width: 1.22,
    x: 0.95,
    y: 2.05,
  },
  {
    agentTile: { x: 8.05, y: 3.42 },
    depth: 0.88,
    height: 0.48,
    width: 1.22,
    x: 6.72,
    y: 2.38,
  },
  {
    agentTile: { x: 7.68, y: 6.16 },
    depth: 0.88,
    height: 0.48,
    width: 1.22,
    x: 6.56,
    y: 4.68,
  },
  {
    agentTile: { x: 3.72, y: 6.12 },
    depth: 0.88,
    height: 0.48,
    width: 1.22,
    x: 2.28,
    y: 4.98,
  },
  {
    agentTile: { x: 3.6, y: 2.0 },
    depth: 0.88,
    height: 0.48,
    width: 1.22,
    x: 2.55,
    y: 0.8,
  },
] satisfies readonly OfficeThreeStationSceneLayout[];

const stationIds = [
  "market_desk",
  "strategy_board",
  "risk_table",
  "report_bay",
  "signal_booth",
] satisfies readonly OfficeStationId[];

const furnitureSemantics = [
  { id: "sofa", label: "Sofa" },
  { id: "coffee-table", label: "Coffee table" },
  { id: "market-terminal", label: "Market terminal" },
  { id: "signal-console", label: "Signal console" },
  { id: "report-bench", label: "Report bench" },
  { id: "strategy-sofa", label: "Strategy sofa" },
  { id: "risk-cabinet", label: "Risk cabinet" },
] as const;

export const boundaryWalls = [
  {
    end: { x: OFFICE_GRID.columns, y: 0 },
    fill: "#a36f6b",
    height: 156,
    start: { x: 0, y: 0 },
    stroke: "#6d4b4d",
  },
  {
    end: { x: OFFICE_GRID.columns, y: OFFICE_GRID.rows },
    fill: "#8b8f98",
    height: 126,
    start: { x: OFFICE_GRID.columns, y: 0 },
    stroke: "#5e626b",
  },
] satisfies readonly OfficeWall[];

export function stationIdFor(index: number): OfficeStationId {
  return stationIds[index] ?? "market_desk";
}

export function furnitureSemantic(index: number): {
  readonly id: string;
  readonly label: string;
} {
  return (
    furnitureSemantics[index] ?? {
      id: `item-${index + 1}`,
      label: `Furniture ${index + 1}`,
    }
  );
}

export function officeThreeFurnitureRect(index: number): OfficeThreeSceneRect {
  const furniture = officeFurnitureRects[index] ?? officeFurnitureRects[0];
  const override = furnitureSceneRects[index];
  return {
    depth: furniture.depth,
    height: Math.max(0.22, furniture.lift * canvasLiftUnit),
    width: furniture.width,
    x: override?.x ?? furniture.x,
    y: override?.y ?? furniture.y,
  };
}

export function officeThreePlanterLocation(index: number): GridPoint {
  return officeThreePlanterLocations[index] ?? officeThreePlanterLocations[0];
}

export function officeThreeStationRect(index: number): OfficeThreeSceneRect {
  return stationSceneLayouts[index] ?? stationSceneLayouts[0];
}

export function officeThreeAgentTile(index: number): GridPoint {
  return (stationSceneLayouts[index] ?? stationSceneLayouts[0]).agentTile;
}

import type { OfficeWall } from "./orchestrator-office-canvas-amenities-data";
import { OFFICE_GRID } from "./orchestrator-office-canvas-geometry";
import type { OfficeStationLabels } from "./orchestrator-office-copy";
import type { OfficeThreeSceneRect } from "./orchestrator-office-three-scene-geometry";

export type OfficeStationId = keyof OfficeStationLabels;

export const commandTable = {
  depth: 1.24,
  height: 0.52,
  width: 2.34,
  x: 4.08,
  y: 3.54,
} satisfies OfficeThreeSceneRect;

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

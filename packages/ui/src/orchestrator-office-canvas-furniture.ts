import { officeFootprint } from "./orchestrator-office-canvas-geometry";
import type {
  OfficeDrawCommand,
  OfficeRotation,
} from "./orchestrator-office-canvas-types";

export function pushFurniture(
  commands: OfficeDrawCommand[],
  rotation: OfficeRotation,
): void {
  commands.push(
    {
      fill: "#b07b9f",
      kind: "polygon",
      lineWidth: 2,
      points: officeFootprint(5.25, 1.1, 1.6, 0.7, rotation, 18),
      stroke: "#7e5472",
    },
    {
      fill: "#d8b47a",
      kind: "polygon",
      lineWidth: 2,
      points: officeFootprint(5.5, 2.0, 1.2, 0.48, rotation, 14),
      stroke: "#90704b",
    },
    {
      fill: "#242c38",
      kind: "polygon",
      lineWidth: 2,
      points: officeFootprint(0.72, 0.74, 0.88, 0.78, rotation, 74),
      stroke: "#6ecde2",
    },
    {
      fill: "#293647",
      kind: "polygon",
      lineWidth: 2,
      points: officeFootprint(2.25, 0.55, 1.22, 0.52, rotation, 68),
      stroke: "#6ecde2",
    },
    {
      fill: "#d78d78",
      kind: "polygon",
      lineWidth: 2,
      points: officeFootprint(3.15, 5.55, 1.3, 0.54, rotation, 18),
      stroke: "#8a5a52",
    },
    {
      fill: "#70c9aa",
      kind: "polygon",
      lineWidth: 2,
      points: officeFootprint(8.0, 0.95, 1.35, 0.68, rotation, 20),
      stroke: "#397b70",
    },
    {
      fill: "#2b3540",
      kind: "polygon",
      lineWidth: 2,
      points: officeFootprint(8.2, 4.85, 0.94, 0.76, rotation, 42),
      stroke: "#64748b",
    },
  );
}

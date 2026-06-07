import type { AgentSlot, OfficeAgent } from "./orchestrator-office-scene-data";

export type OfficeRotation =
  | "south-east"
  | "south-west"
  | "north-west"
  | "north-east";

export type OfficeRotationDirection = "left" | "right";

export type OfficeCanvasPoint = {
  readonly x: number;
  readonly y: number;
};

export type OfficeCanvasQuad = readonly [
  OfficeCanvasPoint,
  OfficeCanvasPoint,
  OfficeCanvasPoint,
  OfficeCanvasPoint,
];

export type OfficeCanvasViewport = {
  readonly width: number;
  readonly height: number;
};

export type OfficeCanvasScene = {
  readonly agents: readonly OfficeAgent[];
  readonly deskSlots: readonly AgentSlot[];
  readonly rotation: OfficeRotation;
};

export type OfficeCanvasPolygonCommand = {
  readonly kind: "polygon";
  readonly points: readonly OfficeCanvasPoint[];
  readonly fill: string;
  readonly stroke?: string;
  readonly lineWidth?: number;
  readonly alpha?: number;
};

export type OfficeCanvasRectCommand = {
  readonly kind: "rect";
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly fill: string;
  readonly radius?: number;
  readonly stroke?: string;
  readonly lineWidth?: number;
  readonly alpha?: number;
};

export type OfficeCanvasAgentCommand = {
  readonly kind: "agent";
  readonly at: OfficeCanvasPoint;
  readonly fill: string;
  readonly shortLabel: string;
  readonly isLead: boolean;
};

export type OfficeCanvasNameplateCommand = {
  readonly kind: "nameplate";
  readonly at: OfficeCanvasPoint;
  readonly label: string;
  readonly station: string;
  readonly accent: string;
  readonly isLead: boolean;
  readonly shortLabel: string;
};

export type OfficeDrawCommand =
  | OfficeCanvasAgentCommand
  | OfficeCanvasNameplateCommand
  | OfficeCanvasPolygonCommand
  | OfficeCanvasRectCommand;

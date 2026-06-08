import type { AgentSlot, OfficeAgent } from "./orchestrator-office-scene-data";

export type OfficeRotation =
  | "south-east"
  | "south-west"
  | "north-west"
  | "north-east";

export type OfficeRotationDirection = "left" | "right";
export type OfficeProjectionCamera = {
  readonly pitch?: number;
  readonly yaw: OfficeRotation | number;
};
export type OfficeProjection = OfficeRotation | number | OfficeProjectionCamera;
export type OfficeVolumeSurface = "shadow" | "front" | "side" | "top";

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
  readonly angle?: number;
  readonly deskSlots: readonly AgentSlot[];
  readonly pitch?: number;
  readonly rotation: OfficeRotation;
};

type OfficeCanvasVolumeMeta = {
  readonly surface?: OfficeVolumeSurface;
  readonly volumeId?: string;
};

export type OfficeCanvasPolygonCommand = OfficeCanvasVolumeMeta & {
  readonly kind: "polygon";
  readonly points: readonly OfficeCanvasPoint[];
  readonly fill: string;
  readonly stroke?: string;
  readonly lineWidth?: number;
  readonly alpha?: number;
};

export type OfficeCanvasRectCommand = OfficeCanvasVolumeMeta & {
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
